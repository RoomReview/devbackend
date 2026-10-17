import { UserSelect, UserCreateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';
import { InternalServerError, ValidationError } from '@/utils/custom-error';

const logContext: LogContext = {
  service: 'UserRepository',
  function: '',
};

export const createUser = async (
  user: UserCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends' | '$transaction'
  > = prisma,
) => {
  return await tx.user.create({ data: user }).catch((err: unknown) => {
    logContext.function = 'createUser';
    logger.error(logContext, 'Error in createUser repository', { error: err });
    throw new Error('DB: user create operation failed');
  });
};

export const findUserByEmail = async (email: string, select?: UserSelect) => {
  return await prisma.user.findUnique({ where: { email }, select }).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Prisma raw error in findUserByEmail:', err);
    logContext.function = 'findUserByEmail';
    logger.error(logContext, 'Error in findUserByEmail repository', { error: err });
    // Include underlying error message to aid debugging in development
    const errorMessage = err instanceof Error ? err.message : 'unknown error';
    throw new Error(`DB: findUserByEmail operation failed: ${errorMessage}`);
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
  }).catch((err: unknown) => {
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
  }).catch((err: unknown) => {
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
  }).catch((err: unknown) => {
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
  }).catch((err: unknown) => {
    logContext.function = 'findAllUsers';
    logger.error(logContext, 'Error in findAllUsers repository', { error: err });
    throw new Error('DB: findAllUsers operation failed');
  });
};

export const findUserById = async (userId: string, select?: UserSelect) => {
  return await prisma.user.findUnique({ where: { userId }, select }).catch((err: unknown) => {
    logContext.function = 'findUserById';
    logger.error(logContext, 'Error in findUserById repository', { error: err });
    throw new Error('DB: findUserById operation failed');
  });
};

export const updateUserPassword = async (
  userId: string,
  passwordHash: string,
) => {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { userId },
      data: { passwordHash },
    });
    await tx.session.updateMany({
      where: { userId },
      data: {
        accessTokenId: null,
        accessTokenExpiry: null,
        refreshTokenId: null,
        refreshTokenExpiry: null,
      },
    });
    return user;
  }).catch((err: unknown) => {
    logContext.function = 'updateUserPassword';
    logger.error(logContext, 'Error in updateUserPassword repository', { error: err });
    throw new Error('DB: updateUserPassword operation failed');
  });
};

export interface EmailPreferences {
  emailOnReviewApproved: boolean;
  emailOnReviewRejected: boolean;
}

export const getEmailPreferences = async (userId: string): Promise<EmailPreferences | null> => {
  const rows = await prisma.$queryRaw<EmailPreferences[]>`
    SELECT email_on_review_approved AS "emailOnReviewApproved",
      email_on_review_rejected AS "emailOnReviewRejected"
    FROM users
    WHERE user_id = ${userId}::uuid
  `;
  return rows[0] ?? null;
};

export const updateEmailPreferences = async (
  userId: string,
  preferences: EmailPreferences,
): Promise<EmailPreferences | null> => {
  const rows = await prisma.$queryRaw<EmailPreferences[]>`
    UPDATE users
    SET email_on_review_approved = ${preferences.emailOnReviewApproved},
      email_on_review_rejected = ${preferences.emailOnReviewRejected},
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}::uuid
    RETURNING email_on_review_approved AS "emailOnReviewApproved",
      email_on_review_rejected AS "emailOnReviewRejected"
  `;
  return rows[0] ?? null;
};

export interface ReviewNotificationRecipient extends EmailPreferences {
  email: string;
  firstName: string;
}

export const getReviewNotificationRecipient = async (
  userId: string,
): Promise<ReviewNotificationRecipient | null> => {
  const rows = await prisma.$queryRaw<ReviewNotificationRecipient[]>`
    SELECT email, first_name AS "firstName",
      email_on_review_approved AS "emailOnReviewApproved",
      email_on_review_rejected AS "emailOnReviewRejected"
    FROM users
    WHERE user_id = ${userId}::uuid
  `;
  return rows[0] ?? null;
};

export const updateUserPasswordAndClearCode = async (
  userId: string,
  passwordHash: string,
) => {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { userId },
      data: {
        passwordHash,
        verifyCodeHash: null,
        verifyCodeExpiry: null,
      },
    });
    await tx.session.updateMany({
      where: { userId },
      data: {
        accessTokenId: null,
        accessTokenExpiry: null,
        refreshTokenId: null,
        refreshTokenExpiry: null,
      },
    });
    return user;
  }).catch((err: unknown) => {
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
  }).catch((err: unknown) => {
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
  }).catch((err: unknown) => {
    logContext.function = 'findUserByFacebookId';
    logger.error(logContext, 'Error in findUserByFacebookId repository', { error: err });
    throw new Error('DB: findUserByFacebookId operation failed');
  });
};

export type SsoCreateInput = {
  email: string;
  firstName: string;
  lastName: string;
  googleId?: string;
  facebookId?: string;
};

/**
 * Creates an SSO user without linking the provider identity to an existing email.
 */
export const createSsoUser = async (data: SsoCreateInput) => {
  const { email, firstName, lastName, googleId, facebookId } = data;
  try {
    return await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        isEmailVerified: true,
        isActive: true,
        googleId: googleId ?? null,
        facebookId: facebookId ?? null,
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
    });
  } catch (error) {
    logContext.function = 'createSsoUser';
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ValidationError({
        message: 'An account with this email already exists. Please sign in with your existing account.',
        code: 'VALIDATION_ERROR',
      });
    }
    logger.error(logContext, 'Error in createSsoUser repository', { error });
    throw new InternalServerError({
      message: 'Unable to create SSO account',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
};
