import { createHash, randomBytes, randomUUID } from 'node:crypto';
import prisma from '@config/database';
import { ensureSubscriptionSeatLimit } from '@/services/payment.service';
import { sendAgencyInvitationEmail } from '@/utils/email';
import { EntityNotFoundError, UnauthorizedError, ValidationError } from '@/utils/custom-error';

const hashInvitationToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

const assertInvitationToken = (token: string) => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new EntityNotFoundError({ message: 'Invitation not found or expired', code: 'ENTITY_NOT_FOUND' });
  }
};

export const calculateTeamSeatUsage = (seatLimit: number, memberCount: number, invitationCount: number) => {
  const usedSeats = memberCount + invitationCount;
  return { seatLimit, usedSeats, availableSeats: Math.max(0, seatLimit - usedSeats) };
};

const findOwnedAgency = async (ownerUserId: string) => {
  const rows = await prisma.$queryRaw<Array<{
    agencyId: string;
    agencyName: string;
    ownerName: string;
    role: string;
  }>>`
    SELECT agencies.agency_id AS "agencyId", agencies.name AS "agencyName",
      CONCAT(users.first_name, ' ', users.last_name) AS "ownerName", users.role::text AS role
    FROM users
    LEFT JOIN agencies ON agencies.owner_user_id = users.user_id
    WHERE users.user_id = ${ownerUserId}::uuid
    LIMIT 1
  `;
  const owner = rows[0];
  if (!owner || (owner.role !== 'AGENCY' && owner.role !== 'AGENT')) {
    throw new UnauthorizedError({ message: 'Only agency and agent accounts can manage team members' });
  }
  if (!owner.agencyId) {
    throw new ValidationError({ message: 'Your agency profile is not available for team management', code: 'VALIDATION_ERROR' });
  }
  return owner;
};

const getSeatUsage = async (
  agencyId: string,
  ownerUserId: string,
  seatLimit: number,
  queryable: Pick<typeof prisma, '$queryRaw'> = prisma,
) => {
  const rows = await queryable.$queryRaw<Array<{ memberCount: number; invitationCount: number }>>`
    SELECT
      (SELECT COUNT(*)::int FROM user_agency
        WHERE agency_id = ${agencyId}::uuid AND user_id <> ${ownerUserId}::uuid) AS "memberCount",
      (SELECT COUNT(*)::int FROM agency_invitations
        WHERE agency_id = ${agencyId}::uuid AND accepted_at IS NULL AND expires_at > CURRENT_TIMESTAMP) AS "invitationCount"
  `;
  return calculateTeamSeatUsage(
    seatLimit,
    rows[0]?.memberCount ?? 0,
    rows[0]?.invitationCount ?? 0,
  );
};

export const getTeam = async (ownerUserId: string) => {
  const owner = await findOwnedAgency(ownerUserId);
  const subscription = await ensureSubscriptionSeatLimit(ownerUserId);
  const seatLimit = subscription?.status === 'ACTIVE' ? subscription.seatLimit : 0;
  const [usage, members, invitations] = await Promise.all([
    getSeatUsage(owner.agencyId, ownerUserId, seatLimit),
    prisma.$queryRaw<Array<{
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      joinedAt: Date;
    }>>`
      SELECT users.user_id AS "userId", users.email, users.first_name AS "firstName",
        users.last_name AS "lastName", users.role::text AS role, user_agency.created_at AS "joinedAt"
      FROM user_agency JOIN users ON users.user_id = user_agency.user_id
      WHERE user_agency.agency_id = ${owner.agencyId}::uuid
        AND user_agency.user_id <> ${ownerUserId}::uuid
      ORDER BY user_agency.created_at ASC
    `,
    prisma.$queryRaw<Array<{
      invitationId: string;
      email: string;
      createdAt: Date;
      expiresAt: Date;
    }>>`
      SELECT agency_invitation_id AS "invitationId", email,
        created_at AS "createdAt", expires_at AS "expiresAt"
      FROM agency_invitations
      WHERE agency_id = ${owner.agencyId}::uuid
        AND accepted_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at ASC
    `,
  ]);
  return { agencyName: owner.agencyName, ...usage, members, invitations };
};

export const createTeamInvitation = async (ownerUserId: string, rawEmail: string) => {
  const email = rawEmail.trim().toLowerCase();
  await findOwnedAgency(ownerUserId);
  await ensureSubscriptionSeatLimit(ownerUserId);
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashInvitationToken(token);
  const invitation = await prisma.$transaction(async (tx) => {
    const ownerRows = await tx.$queryRaw<Array<{ role: string; firstName: string; lastName: string }>>`
      SELECT role::text AS role, first_name AS "firstName", last_name AS "lastName"
      FROM users WHERE user_id = ${ownerUserId}::uuid FOR UPDATE
    `;
    const ownerUser = ownerRows[0];
    if (!ownerUser || (ownerUser.role !== 'AGENCY' && ownerUser.role !== 'AGENT')) {
      throw new UnauthorizedError({ message: 'Only agency and agent accounts can invite team members' });
    }

    const agencyRows = await tx.$queryRaw<Array<{ agencyId: string; agencyName: string }>>`
      SELECT agency_id AS "agencyId", name AS "agencyName"
      FROM agencies WHERE owner_user_id = ${ownerUserId}::uuid LIMIT 1
    `;
    const agency = agencyRows[0];
    if (!agency) {
      throw new ValidationError({ message: 'Your agency profile is not available for team management', code: 'VALIDATION_ERROR' });
    }

    const subscriptions = await tx.$queryRaw<Array<{ seatLimit: number }>>`
      SELECT seat_limit AS "seatLimit" FROM billing_subscriptions
      WHERE user_id = ${ownerUserId}::uuid AND status = 'ACTIVE'::"BillingSubscriptionStatus"
      LIMIT 1
    `;
    const seatLimit = subscriptions[0]?.seatLimit ?? 0;
    const usage = await getSeatUsage(agency.agencyId, ownerUserId, seatLimit, tx);
    if (usage.availableSeats < 1) {
      throw new ValidationError({
        message: seatLimit === 0
          ? 'An active team subscription is required before inviting members'
          : 'All team seats are occupied. Upgrade your subscription to invite more people.',
        code: 'VALIDATION_ERROR',
      });
    }

    const existingMembers = await tx.$queryRaw<Array<{ userId: string }>>`
      SELECT user_agency.user_id AS "userId"
      FROM user_agency JOIN users ON users.user_id = user_agency.user_id
      WHERE user_agency.agency_id = ${agency.agencyId}::uuid AND LOWER(users.email) = ${email}
      LIMIT 1
    `;
    if (existingMembers.length > 0) {
      throw new ValidationError({ message: 'This person is already a team member', code: 'VALIDATION_ERROR' });
    }
    const existingInvitations = await tx.$queryRaw<Array<{ invitationId: string }>>`
      SELECT agency_invitation_id AS "invitationId" FROM agency_invitations
      WHERE agency_id = ${agency.agencyId}::uuid AND LOWER(email) = ${email}
        AND accepted_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `;
    if (existingInvitations.length > 0) {
      throw new ValidationError({ message: 'An active invitation already exists for this email', code: 'VALIDATION_ERROR' });
    }

    const invitationId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await tx.$executeRaw`
      INSERT INTO agency_invitations
        (agency_invitation_id, agency_id, email, token_hash, expires_at)
      VALUES (
        ${invitationId}::uuid, ${agency.agencyId}::uuid, ${email}, ${tokenHash},
        ${expiresAt}
      )
    `;
    return {
      invitationId,
      email,
      agencyName: agency.agencyName,
      inviterName: [ownerUser.firstName, ownerUser.lastName].filter(Boolean).join(' ') || email,
      expiresAt,
    };
  });

  try {
    await sendAgencyInvitationEmail(invitation.email, invitation.inviterName, invitation.agencyName, token);
  } catch (error) {
    await prisma.$executeRaw`
      DELETE FROM agency_invitations
      WHERE agency_invitation_id = ${invitation.invitationId}::uuid AND accepted_at IS NULL
    `;
    throw error;
  }
  return { email: invitation.email, expiresAt: invitation.expiresAt };
};

export const getInvitationDetails = async (token: string) => {
  assertInvitationToken(token);
  const invitations = await prisma.$queryRaw<Array<{ email: string; agencyName: string; expiresAt: Date }>>`
    SELECT agency_invitations.email, agencies.name AS "agencyName",
      agency_invitations.expires_at AS "expiresAt"
    FROM agency_invitations JOIN agencies ON agencies.agency_id = agency_invitations.agency_id
    WHERE agency_invitations.token_hash = ${hashInvitationToken(token)}
      AND agency_invitations.accepted_at IS NULL
      AND agency_invitations.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `;
  if (!invitations[0]) {
    throw new EntityNotFoundError({ message: 'Invitation not found or expired', code: 'ENTITY_NOT_FOUND' });
  }
  return invitations[0];
};

export const acceptTeamInvitation = async (userId: string, token: string) => {
  assertInvitationToken(token);
  return prisma.$transaction(async (tx) => {
    const invitations = await tx.$queryRaw<Array<{
      invitationId: string;
      agencyId: string;
      email: string;
      ownerUserId: string;
    }>>`
      SELECT agency_invitations.agency_invitation_id AS "invitationId",
        agency_invitations.agency_id AS "agencyId", agency_invitations.email,
        agencies.owner_user_id AS "ownerUserId"
      FROM agency_invitations JOIN agencies ON agencies.agency_id = agency_invitations.agency_id
      WHERE agency_invitations.token_hash = ${hashInvitationToken(token)}
        AND agency_invitations.accepted_at IS NULL
        AND agency_invitations.expires_at > CURRENT_TIMESTAMP
      LIMIT 1 FOR UPDATE OF agency_invitations
    `;
    const invitation = invitations[0];
    if (!invitation) {
      throw new EntityNotFoundError({ message: 'Invitation not found or expired', code: 'ENTITY_NOT_FOUND' });
    }
    const users = await tx.$queryRaw<Array<{ email: string }>>`
      SELECT email FROM users WHERE user_id = ${userId}::uuid LIMIT 1
    `;
    if (users[0]?.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new UnauthorizedError({ message: 'Sign in with the email address that received this invitation' });
    }
    await tx.$executeRaw`
      INSERT INTO user_agency (user_agency_id, user_id, agency_id, is_verified, created_at, updated_at)
      VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${invitation.agencyId}::uuid, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, agency_id) DO NOTHING
    `;
    await tx.$executeRaw`
      UPDATE agency_invitations SET accepted_at = CURRENT_TIMESTAMP
      WHERE agency_invitation_id = ${invitation.invitationId}::uuid
    `;
    return { accepted: true };
  });
};

export const removeTeamMember = async (ownerUserId: string, memberUserId: string) => {
  const owner = await findOwnedAgency(ownerUserId);
  if (ownerUserId === memberUserId) {
    throw new ValidationError({ message: 'The account owner cannot be removed from the team', code: 'VALIDATION_ERROR' });
  }
  const removed = await prisma.$executeRaw`
    DELETE FROM user_agency
    WHERE user_id = ${memberUserId}::uuid AND agency_id = ${owner.agencyId}::uuid
  `;
  if (removed === 0) {
    throw new EntityNotFoundError({ message: 'Team member not found', code: 'ENTITY_NOT_FOUND' });
  }
  return { removed: true };
};

export const revokeTeamInvitation = async (ownerUserId: string, invitationId: string) => {
  const owner = await findOwnedAgency(ownerUserId);
  const deleted = await prisma.$executeRaw`
    DELETE FROM agency_invitations
    WHERE agency_invitation_id = ${invitationId}::uuid
      AND agency_id = ${owner.agencyId}::uuid AND accepted_at IS NULL
  `;
  if (deleted === 0) {
    throw new EntityNotFoundError({ message: 'Invitation not found', code: 'ENTITY_NOT_FOUND' });
  }
  return { revoked: true };
};
