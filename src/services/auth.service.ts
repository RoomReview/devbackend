import {
  RegisterUserDto,
  EarlyAccessRegisterDto,
  VerifyEmailCodeDto,
  ResetPasswordDto,
} from '@/dto/auth.dto';
import {
  findUserByEmail,
  getUserSensitiveByEmail,
  updateUserPasswordAndClearCode,
  registerUser as createUserAccount,
  registerEarlyAccessUser as createEarlyAccessUserAccount,
} from './user.service';
import { comparePassword, hashPassword } from '../utils/password';
import {
  generateVerificationCode,
  generatePasswordResetToken,
  verifyCode,
  isCodeExpired,
  hashCode,
} from '../utils/token';
import {
  findUserSessionByAccessTokenId,
  logoutSessionByUserId,
  upsertSession,
  rotateActiveUserSession,
} from '@/repositories/sessions.repository';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../utils/jwt.token';
import logger, { LogContext } from '@/utils/logger';
import {
  EntityNotFoundError,
  InternalServerError,
  UnauthorizedError,
  ValidationError,
} from '@utils/custom-error';
import {
  findUserByVerifyCodeHash,
  updateUserVerifyCode,
  verifyUserEmail as verifyUserEmailRepo,
  findUserByGoogleId,
  findUserByFacebookId,
  findUserById,
  createSsoUser,
} from '@/repositories/users.repository';
import {
  consumeSsoLoginCode,
  createSsoLoginCode as createSsoLoginCodeRecord,
} from '@/repositories/sso-login-codes.repository';
import { sendResetPasswordEmail, sendVerificationEmail } from '@/utils/email';
import config from '@/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isDisposableEmail } from '@/utils/disposable-email';

const logContext: LogContext = {
  service: 'auth.service',
  function: '',
};

export const registerUser = async (data: RegisterUserDto) => {
  logContext.function = 'registerUser';
  const existingUser = await findUserByEmail(data.email);
  if (existingUser) {
    throw new ValidationError({
      message: 'This email address is already taken',
      code: 'VALIDATION_ERROR',
    });
  }

  const hashedPassword = await hashPassword(data.password);

  const token = generateVerificationCode();

  let emailSent = false;
  try {
    await sendVerificationEmail(
      data.email,
      token.code,
      `${data.firstName} ${data.lastName}`,
    );
    emailSent = true;
  } catch (error) {
    logger.warn(logContext, 'Verification email could not be sent; continuing registration', {
      email: data.email,
      error,
    });
  }

  const user = await createUserAccount(data, hashedPassword, {
    expiresAt: token.expiresAt,
    hashedCode: token.hashedCode,
  });

  const { passwordHash, verifyCodeHash, ...userWithoutSensitive } = user;

  return {
    user: userWithoutSensitive,
    session: {},
    isExistingUser: false,
    emailSent,
    verificationCode: emailSent ? undefined : token.code,
  };
};

export const registerEarlyAccessUser = async (data: EarlyAccessRegisterDto) => {
  logContext.function = 'registerEarlyAccessUser';
  const normalizedData = {
    ...data,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim().toLowerCase(),
  };
  if (isDisposableEmail(normalizedData.email)) {
    throw new ValidationError({
      message: 'Please use a non-disposable email address',
      code: 'VALIDATION_ERROR',
    });
  }

  if (await findUserByEmail(normalizedData.email)) {
    throw new ValidationError({
      message: 'This email address is already taken',
      code: 'VALIDATION_ERROR',
    });
  }

  const passwordHash = await hashPassword(normalizedData.password);
  const verification = generateVerificationCode();
  const userId = randomUUID();

  let account: Awaited<ReturnType<typeof createEarlyAccessUserAccount>>;
  try {
    account = await createEarlyAccessUserAccount(
      userId,
      {
        email: normalizedData.email,
        firstName: normalizedData.firstName,
        lastName: normalizedData.lastName,
      },
      passwordHash,
      verification,
    );
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ValidationError({
        message: 'This email address is already taken',
        code: 'VALIDATION_ERROR',
      });
    }
    throw error;
  }
  const { user, trialEndsAt } = account;

  let emailSent = false;
  try {
    await sendVerificationEmail(
      user.email,
      verification.code,
      `${user.firstName} ${user.lastName}`,
    );
    emailSent = true;
  } catch (error) {
    logger.warn(logContext, 'Early access verification email could not be sent', {
      email: user.email,
      error,
    });
  }

  return {
    user: {
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      trialStartedAt: user.trialStartedAt,
      trialEndsAt: user.trialEndsAt,
    },
    trialEndsAt,
    emailSent,
  };
};

export const loginUser = async (email: string, password: string) => {
  const user = await getUserSensitiveByEmail(email);
  if (!user) {
    return { user: null, session: null };
  }

  const { passwordHash, ...userWithoutPassword } = user;

  if (!user.isActive || !user.isEmailVerified) {
    return { user: userWithoutPassword, session: null };
  }

  if (!(await comparePassword(password, user?.passwordHash ?? ''))) {
    throw new UnauthorizedError({
      message: 'Invalid credentials',
      code: 'VALIDATION_ERROR',
    });
  }

  const accessTokenObj = generateAccessToken({
    email: user.email,
    sub: user.userId,
    role: user.role,
  });

  const refreshTokenObj = generateRefreshToken({
    email: user.email,
    sub: user.userId,
    role: user.role,
  });

  const currentSession = await upsertSession({
    userId: user.userId,
    accessTokenId: accessTokenObj?.jti ?? null,
    refreshTokenId: refreshTokenObj?.jti ?? null,
    accessTokenExpiry: accessTokenObj.expiresAt ?? null,
    refreshTokenExpiry: refreshTokenObj.expiresAt ?? null,
  });

  return {
    user: userWithoutPassword,
    session: {
      ...currentSession,
      accessToken: accessTokenObj.token,
      refreshToken: refreshTokenObj.token,
    },
  };
};

export const logoutUser = async (userId: string) => {
  return await logoutSessionByUserId(userId);
};

export const resetEmailVerification = async (email: string) => {
  logContext.function = 'resetEmailVerification';

  const user = await findUserByEmail(email);
  if (!user) {
    throw new EntityNotFoundError({
      message: 'User not found',
      code: 'ENTITY_NOT_FOUND',
    });
  }

  if (user.isEmailVerified) {
    throw new ValidationError({
      message: 'Email is already verified',
      code: 'VALIDATION_ERROR',
    });
  }

  const token = generateVerificationCode();

  await updateUserVerifyCode(email, token.hashedCode, token.expiresAt);

  return { isNewCodeGenerated: true };
};

export const forgotPassword = async (email: string) => {
  logContext.function = 'forgotPassword';

  const user = await findUserByEmail(email);
  if (!user) {
    // Return early to prevent email enumeration, keeping the same success shape.
    return { isEmailSent: true };
  }

  if (!user.isActive) {
    throw new ValidationError({
      message: 'Account is deactivated',
      code: 'VALIDATION_ERROR',
    });
  }

  const token = generatePasswordResetToken();
  const resetPasswordLink = config.sendGridTemplateParameters[config.sendResetPasswordCodeV1TemplateId].reset_pswd_button_link;
  const resetPasswordUrl = `${resetPasswordLink}?token=${token.code}&email=${encodeURIComponent(email)}`;

  await updateUserVerifyCode(email, token.hashedCode, token.expiresAt);
  await sendResetPasswordEmail(email, `${user.firstName} ${user.lastName}`, resetPasswordUrl);

  return { isEmailSent: true };
};

export const resetPassword = async (data: ResetPasswordDto) => {
  logContext.function = 'resetPassword';
  const { email, code, newPassword } = data;

  const hashedCode = hashCode(code);
  const user = await findUserByVerifyCodeHash(email, hashedCode);

  if (!user) {
    throw new ValidationError({
      message: 'Invalid verification code',
      code: 'VALIDATION_ERROR',
    });
  }

  const fullUser = await findUserByEmail(email);
  if (!fullUser?.isActive) {
    throw new ValidationError({
      message: 'Account is deactivated',
      code: 'VALIDATION_ERROR',
    });
  }

  if (!user.verifyCodeExpiry || isCodeExpired(user.verifyCodeExpiry)) {
    throw new ValidationError({
      message: 'Verification code has expired',
      code: 'VALIDATION_ERROR',
    });
  }

  if (!verifyCode(code, user.verifyCodeHash!)) {
    throw new ValidationError({
      message: 'Invalid verification code',
      code: 'VALIDATION_ERROR',
    });
  }

  const newHashedPassword = await hashPassword(newPassword);
  await updateUserPasswordAndClearCode(user.userId, newHashedPassword);


  return { success: true };
};

export const verifyEmail = async (data: VerifyEmailCodeDto) => {
  logContext.function = 'verifyEmail';
  const { code, email } = data;

  const hashedCode = hashCode(code);

  const user = await findUserByVerifyCodeHash(email, hashedCode);

  if (!user) {
    throw new ValidationError({
      message: 'Invalid verification code',
      code: 'VALIDATION_ERROR',
    });
  }

  if (!user.verifyCodeExpiry || isCodeExpired(user.verifyCodeExpiry)) {
    throw new ValidationError({
      message: 'Verification code has expired',
      code: 'VALIDATION_ERROR',
    });
  }

  if (!verifyCode(code, user.verifyCodeHash!)) {
    throw new ValidationError({
      message: 'Invalid verification code',
      code: 'VALIDATION_ERROR',
    });
  }

  const updatedUser = await verifyUserEmailRepo(user.email);
  const accessToken = generateAccessToken({
    email: updatedUser.email,
    sub: updatedUser.userId,
    role: updatedUser.role,
  });
  const refreshToken = generateRefreshToken({
    email: updatedUser.email,
    sub: updatedUser.userId,
    role: updatedUser.role,
  });
  const session = await upsertSession({
    userId: updatedUser.userId,
    accessTokenId: accessToken.jti ?? null,
    accessTokenExpiry: accessToken.expiresAt ?? null,
    refreshTokenId: refreshToken.jti ?? null,
    refreshTokenExpiry: refreshToken.expiresAt ?? null,
  });

  logger.info(logContext, 'Email verified successfully', { email: user.email });

  return {
    user: updatedUser,
    session: {
      ...session,
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
    },
  };
};

export const validateAccessToken = async (token: string) => {
  logContext.function = 'validateAccessToken';
  const { email, role, sub, jti } = verifyAccessToken(token);
  if (!email) {
    throw new UnauthorizedError({ message: 'Invalid token' });
  }

  if (!jti) {
    throw new UnauthorizedError({ message: 'Invalid token' });
  }

  const session = await findUserSessionByAccessTokenId(jti, sub);
  if (!session) {
    throw new UnauthorizedError({ message: 'Invalid token' });
  }
  const user = await findUserById(sub, { isActive: true });
  if (!user?.isActive) {
    throw new UnauthorizedError({
      message: 'Account is deactivated',
      code: 'UNAUTHORIZED',
    });
  }

  return { user: { email, role, userId: sub }, session };
};

export const refreshAccessToken = async (refreshToken: string) => {
  logContext.function = 'refreshAccessToken';

  // Verify signature, expiry, issuer & audience — throws UnauthorizedError on failure
  const { sub: userId, email, role, jti } = verifyRefreshToken(refreshToken);

  if (!jti) {
    throw new UnauthorizedError({
      message: 'Invalid refresh token: missing jti',
    });
  }

  // Issue fresh access and refresh tokens
  const accessTokenObj = generateAccessToken({ email, sub: userId, role });
  const refreshTokenObj = generateRefreshToken({ email, sub: userId, role });
  if (!accessTokenObj.jti || !refreshTokenObj.jti) {
    throw new InternalServerError({
      message: 'Unable to create refreshed session tokens',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }

  const rotated = await rotateActiveUserSession({
    userId,
    refreshTokenId: jti,
    accessTokenId: accessTokenObj.jti,
    accessTokenExpiry: accessTokenObj.expiresAt ?? null,
    newRefreshTokenId: refreshTokenObj.jti,
    refreshTokenExpiry: refreshTokenObj.expiresAt ?? null,
  });
  if (!rotated) {
    throw new UnauthorizedError({
      message: 'Refresh token is not recognised, revoked, or the account is deactivated',
      code: 'UNAUTHORIZED',
    });
  }

  logger.info(logContext, 'Access token refreshed', { userId });

  return {
    accessToken: accessTokenObj.token,
    refreshToken: refreshTokenObj.token,
    expiresAt: accessTokenObj.expiresAt,
  };
};

// ---------------------------------------------------------------------------
// SSO helpers
// ---------------------------------------------------------------------------

export type SsoProvider = 'google' | 'facebook';

export interface SsoProfile {
  provider: SsoProvider;
  /** Provider's own subject ID */
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Logs in an existing user or registers a new one via an SSO provider.
 * Lookup order:
 *   1. Find by provider-specific ID (googleId / facebookId)
 *   2. Reject email matches not already linked to this provider
 *   3. Create a brand-new SSO-only user
 * In all cases a JWT session is upserted and returned.
 */
export const loginOrRegisterSsoUser = async (profile: SsoProfile) => {
  logContext.function = 'loginOrRegisterSsoUser';
  const { provider, id, email, firstName, lastName } = profile;

  // 1. Try provider-specific lookup
  const byId =
    provider === 'google'
      ? await findUserByGoogleId(id)
      : await findUserByFacebookId(id);

  let user = byId;
  if (!user) {
    const existingEmail = await findUserByEmail(email, { userId: true });
    if (existingEmail) {
      throw new ValidationError({
        message: 'An account with this email already exists. Please sign in with your existing account.',
        code: 'VALIDATION_ERROR',
      });
    }

    user = await createSsoUser({
      email,
      firstName,
      lastName,
      googleId: provider === 'google' ? id : undefined,
      facebookId: provider === 'facebook' ? id : undefined,
    });
  }

  if (!user.isActive) {
    throw new ValidationError({
      message: 'Account is deactivated',
      code: 'VALIDATION_ERROR',
    });
  }

  logger.info(logContext, 'SSO login successful', { provider, userId: user.userId });

  return { user };
};

const hashSsoLoginCode = (code: string) =>
  createHash('sha256').update(code).digest('hex');

export const createSsoLoginCode = async (userId: string): Promise<string> => {
  const code = randomBytes(32).toString('base64url');
  await createSsoLoginCodeRecord(
    hashSsoLoginCode(code),
    userId,
    new Date(Date.now() + 2 * 60 * 1000),
  );
  return code;
};

export const exchangeSsoLoginCode = async (code: string) => {
  const userId = await consumeSsoLoginCode(hashSsoLoginCode(code));
  if (!userId) {
    throw new UnauthorizedError({
      message: 'SSO login code is invalid or expired',
      code: 'UNAUTHORIZED',
    });
  }

  const user = await findUserById(userId, {
    userId: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    isActive: true,
    isEmailVerified: true,
  });
  if (!user?.isActive) {
    throw new UnauthorizedError({
      message: 'SSO account is unavailable',
      code: 'UNAUTHORIZED',
    });
  }

  const accessToken = generateAccessToken({
    email: user.email,
    sub: user.userId,
    role: user.role,
  });
  const refreshToken = generateRefreshToken({
    email: user.email,
    sub: user.userId,
    role: user.role,
  });
  const session = await upsertSession({
    userId: user.userId,
    accessTokenId: accessToken.jti ?? null,
    accessTokenExpiry: accessToken.expiresAt ?? null,
    refreshTokenId: refreshToken.jti ?? null,
    refreshTokenExpiry: refreshToken.expiresAt ?? null,
  });

  return {
    user,
    session: {
      sessionId: session.sessionId,
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
    },
  };
};
