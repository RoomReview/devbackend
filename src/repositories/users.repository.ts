import { UserSelect, UserCreateInput, UserUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'UserRepository',
  function: '',
};

export const createUser = async (
  user: UserCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.user.create({ data: user }).catch(err => {
    logContext.function = 'createUser';
    logger.error(logContext, 'Error in createUser repository', { error: err });
    throw new Error('DB: user create operation failed');
  });
};

export const findUserByEmail = async (email: string, select?: UserSelect) => {
  return await prisma.user.findUnique({ where: { email }, select }).catch(err => {
    logContext.function = 'findUserByEmail';
    logger.error(logContext, 'Error in findUserByEmail repository', { error: err });
    throw new Error('DB: findUserByEmail operation failed');
  });
};

export const findUserByVerifyCodeHash = async (
  email: string,
  hashedCode: string,
) => {
  return await prisma.user.findFirst({
    where: { verifyCodeHash: hashedCode, email },
    select: {
      userId: true,
      email: true,
      isEmailVerified: true,
      verifyCodeHash: true,
      verifyCodeExpiry: true,
    },
  }).catch(err => {
    logContext.function = 'findUserByVerifyCodeHash';
    logger.error(logContext, 'Error in findUserByVerifyCodeHash repository', { error: err });
    throw new Error('DB: findUserByVerifyCodeHash operation failed');
  });
};

export const updateUserVerifyCode = async (
  email: string,
  verifyCodeHash: string,
  verifyCodeExpiry: Date,
) => {
  return await prisma.user.update({
    where: { email },
    data: { verifyCodeHash, verifyCodeExpiry },
    select: { userId: true, email: true, isEmailVerified: true },
  }).catch(err => {
    logContext.function = 'updateUserVerifyCode';
    logger.error(logContext, 'Error in updateUserVerifyCode repository', { error: err });
    throw new Error('DB: updateUserVerifyCode operation failed');
  });
};

export const verifyUserEmail = async (email: string) => {
  return await prisma.user.update({
    where: { email },
    data: {
      isEmailVerified: true,
      verifiedAt: new Date(),
      verifyCodeHash: null,
      verifyCodeExpiry: null,
    },
    select: {
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      isEmailVerified: true,
      verifiedAt: true,
      role: true,
    },
  }).catch(err => {
    logContext.function = 'verifyUserEmail';
    logger.error(logContext, 'Error in verifyUserEmail repository', { error: err });
    throw new Error('DB: verifyUserEmail operation failed');
  });
};

export const findAllUsers = async (limit: number, offset: number) => {
  return await prisma.user.findMany({
    take: limit,
    skip: offset,
    select: {
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      isEmailVerified: true,
      isActive: true,
      role: true,
      createdAt: true,
    },
  }).catch(err => {
    logContext.function = 'findAllUsers';
    logger.error(logContext, 'Error in findAllUsers repository', { error: err });
    throw new Error('DB: findAllUsers operation failed');
  });
};

export const countUsers = async () => {
  return await prisma.user.count().catch(err => {
    logContext.function = 'countUsers';
    logger.error(logContext, 'Error in countUsers repository', { error: err });
    throw new Error('DB: countUsers operation failed');
  });
};

export const findUserById = async (userId: string, select?: UserSelect) => {
  return await prisma.user.findUnique({ where: { userId }, select }).catch(err => {
    logContext.function = 'findUserById';
    logger.error(logContext, 'Error in findUserById repository', { error: err });
    throw new Error('DB: findUserById operation failed');
  });
};

export const updateUserPassword = async (
  userId: string,
  passwordHash: string,
) => {
  return await prisma.user.update({
    where: { userId },
    data: { passwordHash },
  }).catch(err => {
    logContext.function = 'updateUserPassword';
    logger.error(logContext, 'Error in updateUserPassword repository', { error: err });
    throw new Error('DB: updateUserPassword operation failed');
  });
};

export const updateUserPasswordAndClearCode = async (
  userId: string,
  passwordHash: string,
) => {
  return await prisma.user.update({
    where: { userId },
    data: {
      passwordHash,
      verifyCodeHash: null,
      verifyCodeExpiry: null,
    },
  }).catch(err => {
    logContext.function = 'updateUserPasswordAndClearCode';
    logger.error(logContext, 'Error in updateUserPasswordAndClearCode repository', { error: err });
    throw new Error('DB: updateUserPasswordAndClearCode operation failed');
  });
};

export const findUserByGoogleId = async (googleId: string) => {
  return await prisma.user.findUnique({
    where: { googleId },
    select: {
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isEmailVerified: true,
      isActive: true,
      googleId: true,
      facebookId: true,
    },
  }).catch(err => {
    logContext.function = 'findUserByGoogleId';
    logger.error(logContext, 'Error in findUserByGoogleId repository', { error: err });
    throw new Error('DB: findUserByGoogleId operation failed');
  });
};

export const findUserByFacebookId = async (facebookId: string) => {
  return await prisma.user.findUnique({
    where: { facebookId },
    select: {
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isEmailVerified: true,
      isActive: true,
      googleId: true,
      facebookId: true,
    },
  }).catch(err => {
    logContext.function = 'findUserByFacebookId';
    logger.error(logContext, 'Error in findUserByFacebookId repository', { error: err });
    throw new Error('DB: findUserByFacebookId operation failed');
  });
};

export type SsoUpsertInput = {
  email: string;
  firstName: string;
  lastName: string;
  googleId?: string;
  facebookId?: string;
};

/**
 * Creates a new SSO user or, if the email already exists, links the SSO identity
 * onto the existing account (auto-link strategy).
 */
export const upsertSsoUser = async (data: SsoUpsertInput) => {
  const { email, firstName, lastName, googleId, facebookId } = data;
  return await prisma.user.upsert({
    where: { email },
    create: {
      email,
      firstName,
      lastName,
      isEmailVerified: true,
      isActive: true,
      googleId: googleId ?? null,
      facebookId: facebookId ?? null,
    },
    update: {
      ...(googleId ? { googleId } : {}),
      ...(facebookId ? { facebookId } : {}),
    },
    select: {
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isEmailVerified: true,
      isActive: true,
      googleId: true,
      facebookId: true,
    },
  }).catch(err => {
    logContext.function = 'upsertSsoUser';
    logger.error(logContext, 'Error in upsertSsoUser repository', { error: err });
    throw new Error('DB: upsertSsoUser operation failed');
  });
};

export const updateUser = async (
  userId: string,
  data: UserUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.user.update({
    where: { userId },
    data,
  }).catch(err => {
    logContext.function = 'updateUser';
    logger.error(logContext, 'Error in updateUser repository', { error: err });
    throw new Error('DB: user update operation failed');
  });
};

export const deleteUser = async (
  userId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.user.delete({
    where: { userId },
  }).catch(err => {
    logContext.function = 'deleteUser';
    logger.error(logContext, 'Error in deleteUser repository', { error: err });
    throw new Error('DB: user delete operation failed');
  });
};

