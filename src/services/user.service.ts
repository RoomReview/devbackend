import { randomUUID } from 'node:crypto';
import { UserCreateInput, UserSelect } from '@/generated/prisma/models';
import * as userDal from '@/repositories/users.repository';
import { PaginateArgs } from '@/types';
import { ChangePasswordDto } from '@/dto/user.dto';
import { EntityNotFoundError, UnauthorizedError } from '@/utils/custom-error';
import { comparePassword, hashPassword } from '@/utils/password';
import { paginate } from '@/utils/helpers';
import prisma from '@config/database';
import { UserRole } from '@/generated/prisma/enums';
import {
  createAgency,
  createUserAgency,
} from '@/repositories/agencies.repository';
import { RegisterUserDto, type EarlyAccessRegisterDto } from '@/dto/auth.dto';

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
) => {
  return await prisma.$transaction(async (tx) => {
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
        role: data.role as any,
      },
      tx,
    );

    if (data.role === UserRole.AGENCY || data.role === UserRole.AGENT) {
      const trialStartedAt = new Date();
      const trialEndsAt = new Date(trialStartedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      await tx.$executeRaw`
        UPDATE users
        SET trial_started_at = ${trialStartedAt}, trial_ends_at = ${trialEndsAt}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ${newUser.userId}::uuid
      `;
    }

    if (data.role === UserRole.AGENCY || data.role === UserRole.AGENT) {
      const agency = await createAgency(
        {
          name: data.agencyName!,
          description: data.agencyDescription,
          email: data.agencyEmail,
          phone: data.agencyPhone,
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

export const registerEarlyAccessUser = async (
  userId: string,
  data: Omit<EarlyAccessRegisterDto, 'password'>,
  passwordHash: string,
  verification: { expiresAt: Date; hashedCode: string },
) => {
  return prisma.$transaction(async (tx) => {
    const trialStartedAt = new Date();
    const trialEndsAt = new Date(trialStartedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const user = await tx.user.create({
      data: {
        userId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        isEmailVerified: false,
        isActive: true,
        role: UserRole.TENANT,
        verifyCodeHash: verification.hashedCode,
        verifyCodeExpiry: verification.expiresAt,
        trialStartedAt,
        trialEndsAt,
      },
    });
    const userCreditsId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO billing_credit_grants
        (billing_credit_grant_id, user_id, stripe_event_id, stripe_invoice_id, credits)
      VALUES (${randomUUID()}::uuid, ${user.userId}::uuid, ${`early-access-trial:${user.userId}`}, NULL, 3)
    `;
    await tx.$executeRaw`
      INSERT INTO user_credits
        (user_credits_id, user_id, credits_balance, subscription_plan, created_at, updated_at)
      VALUES (${userCreditsId}::uuid, ${user.userId}::uuid, 3, 'FREE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    await tx.$executeRaw`
      INSERT INTO credit_transactions
        (credit_transaction_id, user_credits_id, amount, type, description, balance_after, created_at, updated_at)
      VALUES (${randomUUID()}::uuid, ${userCreditsId}::uuid, 3, 'BONUS', 'Early access: three free branded reports', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    return { user, trialEndsAt };
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
