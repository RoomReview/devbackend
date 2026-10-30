import { createHash, randomUUID } from 'node:crypto';
import { UserCreateInput, UserSelect } from '@/generated/prisma/models';
import * as userDal from '@/repositories/users.repository';
import { PaginateArgs } from '@/types';
import { ChangePasswordDto, UpdateEmailPreferencesDto } from '@/dto/user.dto';
import { EntityNotFoundError, UnauthorizedError, ValidationError } from '@/utils/custom-error';
import { comparePassword, hashPassword } from '@/utils/password';
import { paginate } from '@/utils/helpers';
import prisma from '@config/database';
import { UserRole } from '@/generated/prisma/enums';
import {
  createAgency,
  createUserAgency,
} from '@/repositories/agencies.repository';
import { RegisterUserDto } from '@/dto/auth.dto';

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}
const defaultSelectFields: UserSelect = {
  userId: true,
  firstName: true,
  lastName: true,
  isEmailVerified: true,
  isActive: true,
  email: true,
  role: true,
};

export const findAllUsers = async (data: PaginateArgs) => {
  const { page, limit } = data;
  const { offset } = paginate(page, limit);
  const users = await userDal.findAllUsers(limit, offset);
  return { users };
};

export const findUserById = async (
  id: string,
  selectFields?: UserSelect,
): Promise<User | null> => {
  return (await userDal.findUserById(
    id,
    selectFields || defaultSelectFields,
  )) as User | null;
};

export const getCurrentUserProfile = async (id: string) =>
  userDal.findUserById(id, defaultSelectFields);

export const getUserSensitiveById = async (id: string) => {
  const selectFields: UserSelect = { ...defaultSelectFields, passwordHash: true };
  return await userDal.findUserById(id, selectFields);
};

export const updateUserPassword = async (id: string, passwordHash: string) => {
  return await userDal.updateUserPassword(id, passwordHash);
};

export const updateUserPasswordAndClearCode = async (
  id: string,
  passwordHash: string,
) => {
  return await userDal.updateUserPasswordAndClearCode(id, passwordHash);
};

export const changePassword = async (id: string, data: ChangePasswordDto) => {
  const user = await getUserSensitiveById(id);
  if (!user) {
    throw new EntityNotFoundError({
      message: 'User not found',
      code: 'ENTITY_NOT_FOUND',
    });
  }

  if (!(await comparePassword(data.oldPassword, user.passwordHash ?? ''))) {
    throw new UnauthorizedError({
      message: 'Invalid old password',
      code: 'VALIDATION_ERROR',
    });
  }

  const newPasswordHash = await hashPassword(data.newPassword);
  await updateUserPassword(id, newPasswordHash);


  return { success: true };
};

export const getAccountEmailPreferences = async (userId: string) => {
  const preferences = await userDal.getEmailPreferences(userId);
  if (!preferences) {
    throw new EntityNotFoundError({ message: 'User not found', code: 'ENTITY_NOT_FOUND' });
  }
  return preferences;
};

export const updateAccountEmailPreferences = async (
  userId: string,
  data: UpdateEmailPreferencesDto,
) => {
  const preferences = await userDal.updateEmailPreferences(userId, data);
  if (!preferences) {
    throw new EntityNotFoundError({ message: 'User not found', code: 'ENTITY_NOT_FOUND' });
  }
  return preferences;
};

export const findUserByEmail = async (
  email: string,
  selectFields?: UserSelect,
) => {
  return await userDal.findUserByEmail(
    email,
    selectFields || defaultSelectFields,
  );
};

export const getUserSensitiveByEmail = async (email: string) => {
  const selectFields: UserSelect = { ...defaultSelectFields, passwordHash: true };
  const user = await userDal.findUserByEmail(email, selectFields);
  return user;
};

export const createUser = async (
  data: UserCreateInput,
  isReturnSensitive = false,
) => {
  const user = await userDal.createUser(data);
  if (isReturnSensitive) {
    return user;
  }
  const { passwordHash, verifyCodeHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const registerUser = async (
  data: RegisterUserDto,
  hashedPassword: string,
  token: { expiresAt: Date; hashedCode: string },
  options: { earlyAccessRegistration?: boolean } = {},
) => {
  return await prisma.$transaction(async (tx) => {
    const earlyAccessRegistration = options.earlyAccessRegistration ?? false;
    const invitation = data.inviteToken
      ? (await tx.$queryRaw<Array<{ invitationId: string; agencyId: string; email: string }>>`
          SELECT agency_invitation_id AS "invitationId", agency_id AS "agencyId", email
          FROM agency_invitations
          WHERE token_hash = ${createHash('sha256').update(data.inviteToken).digest('hex')}
            AND accepted_at IS NULL AND expires_at > CURRENT_TIMESTAMP
          LIMIT 1
          FOR UPDATE
        `)[0]
      : null;
    if (data.inviteToken && (
      !invitation ||
      invitation.email.toLowerCase() !== data.email.trim().toLowerCase()
    )) {
      throw new ValidationError({
        message: 'This invitation is invalid, expired, or addressed to another email',
        code: 'VALIDATION_ERROR',
      });
    }
    const trialStartedAt = new Date();
    const hasTrial = data.role === UserRole.AGENCY
      || data.role === UserRole.AGENT
      || data.role === UserRole.TENANT
      || data.role === UserRole.LANDLORD;
    const trialEndsAt = hasTrial && !earlyAccessRegistration
      ? new Date(trialStartedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
      : null;
    const newUser = await userDal.createUser(
      {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        verifyCodeExpiry: token.expiresAt,
        verifyCodeHash: token.hashedCode,
        passwordHash: hashedPassword,
        isEmailVerified: false,
        isActive: true,
        role: data.role,
        trialStartedAt: hasTrial && !earlyAccessRegistration ? trialStartedAt : null,
        trialEndsAt,
        earlyAccessDiscountEligible: earlyAccessRegistration,
      },
      tx,
    );

    const registrationCredits = earlyAccessRegistration
      ? 3
      : data.role === UserRole.TENANT || data.role === UserRole.LANDLORD
        ? 1
        : 0;
    if (registrationCredits > 0) {
      const userCreditsId = randomUUID();
      const eventId = earlyAccessRegistration
        ? `early-access-registration:${newUser.userId}`
        : `registration-trial:${newUser.userId}`;
      const description = earlyAccessRegistration
        ? 'Early access registration: three free reports'
        : 'Registration bonus: one free report';
      await tx.$executeRaw`
        INSERT INTO billing_credit_grants
          (billing_credit_grant_id, user_id, stripe_event_id, stripe_invoice_id, credits)
        VALUES (
          ${randomUUID()}::uuid,
          ${newUser.userId}::uuid,
          ${eventId},
          NULL,
          ${registrationCredits}
        )
      `;
      await tx.$executeRaw`
        INSERT INTO user_credits
          (user_credits_id, user_id, credits_balance, subscription_plan, created_at, updated_at)
        VALUES (${userCreditsId}::uuid, ${newUser.userId}::uuid, ${registrationCredits}, 'FREE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      await tx.$executeRaw`
        INSERT INTO credit_transactions
          (credit_transaction_id, user_credits_id, amount, type, description, balance_after, created_at, updated_at)
        VALUES (
          ${randomUUID()}::uuid,
          ${userCreditsId}::uuid,
          ${registrationCredits},
          'BONUS',
          ${description},
          ${registrationCredits},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `;
    }

    if (!invitation && (data.role === UserRole.AGENCY || data.role === UserRole.AGENT)) {
      const agencyName = data.agencyName?.trim();
      const agencyPhone = data.agencyPhone?.trim();
      if (!agencyName || !agencyPhone) {
        throw new Error('Agency name and phone are required for agency and agent accounts.');
      }
      const agency = await createAgency(
        {
          ownerUserId: newUser.userId,
          name: agencyName,
          description: data.agencyDescription,
          email: data.agencyEmail,
          phone: agencyPhone,
          website: data.agencyWebsite,
        },
        tx,
      );

      await createUserAgency(
        {
          userId: newUser.userId,
          agencyId: agency.agencyId,
          isVerified: false,
        },
        tx,
      );
    }

    return newUser;
  });
};

export const updateUser = async (
  id: string,
  data: Partial<User>,
): Promise<User | null> => {
  // TODO: Implement with Prisma
  console.log(`Updating user: ${id}`, data);
  return null;
};

export const deleteUser = async (id: string): Promise<boolean> => {
  // TODO: Implement with Prisma
  console.log(`Deleting user: ${id}`);
  return true;
};
