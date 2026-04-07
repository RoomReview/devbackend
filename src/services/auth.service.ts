import {
  RegisterUserDto,
  VerifyEmailCodeDto,
  ResetPasswordDto,
} from '@/dto/auth.dto';
import {
  createUser,
  findUserByEmail,
  getUserSensitiveByEmail,
  updateUserPasswordAndClearCode,
} from './user.service';
import { comparePassword, hashPassword } from '../utils/password';
import {
  generateVerificationCode,
  verifyCode,
  isCodeExpired,
  hashCode,
} from '../utils/token';
import {
  findUserSessionByAccessTokenId,
  findUserSessionByRefreshTokenId,
  logoutSessionByUserId,
  updateSessionAccessTokenId,
  upsertSession,
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
  UnauthorizedError,
  ValidationError,
} from '@utils/custom-error';
import {
  findUserByVerifyCodeHash,
  updateUserVerifyCode,
  verifyUserEmail as verifyUserEmailRepo,
  findUserByGoogleId,
  findUserByFacebookId,
  upsertSsoUser,
} from '@/repositories/users.repository';
import { sendResetPasswordEmail, sendVerificationEmail } from '@/utils/email';
import config from '@/config';

const logContext: LogContext = {
  service: 'auth.service',
  function: '',
};

export const registerUser = async (data: RegisterUserDto) => {
  logContext.function = 'registerUser';
  // is user already exist
  const existingUser = await findUserByEmail(data.email);
  if (existingUser) {
    return { user: existingUser, session: {}, isExistingUser: true };
  }

  // hash password
  const hashedPassword = await hashPassword(data.password);

  // generate verification token
  const token = generateVerificationCode();

  logger.info(logContext, 'Verification token generated', { token });

  // TODO: send the verification email with code
  await sendVerificationEmail(data.email, token.code, `${data.firstName} ${data.lastName}`);

  // create user
  const user = await createUser({
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    verifyCodeExpiry: token.expiresAt,
    verifyCodeHash: token.hashedCode,
    passwordHash: hashedPassword,
    isEmailVerified: false,
    isActive: true,
  });


  // TBD: create session (Why register api return session(access&refresh tokens) without email verified)

  return { user, session: {}, isExistingUser: false };
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

  // TBD: Does application allow multiple sessions? If not, we can update the existing session instead of creating new one
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

  // TODO: replace with actual email send once email service is integrated
  logger.info(logContext, 'Verification code reset — dev-only log', {
    email,
    code: token.code,
  });

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

  const token = generateVerificationCode();
  const resetPasswordLink = config.sendGridTemplateParameters[config.sendResetPasswordCodeV1TemplateId].reset_pswd_button_link;
  const resetPasswordUrl = `${resetPasswordLink}?token=${token.code}&email=${email}`;

  await sendResetPasswordEmail(email, user.firstName + ' ' + user.lastName, resetPasswordUrl);
  await updateUserVerifyCode(email, token.hashedCode, token.expiresAt);

  // TODO: Send password reset email with the 6-digit code `token.code`
  logger.info(logContext, 'Password reset code generated — dev-only log', {
    email,
    code: token.code,
    resetPasswordUrl,
  });

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

  // Note: we fetch the full user from findUserByVerifyCodeHash so we don't need to re-fetch
  // Wait, let's fetch full user details just to be safe they are active
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

  // TODO: send password reset confirmation email

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

  logger.info(logContext, 'Email verified successfully', { email: user.email });

  return { user: updatedUser };
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

  return { user: { email, role, userId: sub }, session };
};

export const refreshAccessToken = async (
  userId: string,
  refreshToken: string,
) => {
  logContext.function = 'refreshAccessToken';

  // Verify signature, expiry, issuer & audience — throws UnauthorizedError on failure
  const { sub, email, role, jti } = verifyRefreshToken(refreshToken);

  // Defence-in-depth: confirm JWT subject matches the supplied userId
  if (sub !== userId) {
    throw new UnauthorizedError({
      message: 'Token does not match the provided userId',
    });
  }

  if (!jti) {
    throw new UnauthorizedError({
      message: 'Invalid refresh token: missing jti',
    });
  }

  // Look up live session — absence means the token was revoked or never stored
  const session = await findUserSessionByRefreshTokenId(jti, userId);
  if (!session) {
    throw new UnauthorizedError({
      message: 'Refresh token is not recognised or has been revoked',
    });
  }

  // Issue a fresh access token
  const accessTokenObj = generateAccessToken({ email, sub: userId, role });

  // Persist the new access token JTI + expiry on the session
  await updateSessionAccessTokenId({
    sessionId: session.sessionId,
    accessTokenId: accessTokenObj.jti ?? null,
    accessTokenExpiry: accessTokenObj.expiresAt ?? null,
  });

  logger.info(logContext, 'Access token refreshed', { userId });

  return {
    accessToken: accessTokenObj.token,
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
 *   2. Auto-link: find by email and attach SSO identity
 *   3. Create brand-new SSO-only user
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

  // 2. Auto-link by email (or create new) via upsert
  const user =
    byId ??
    (await upsertSsoUser({
      email,
      firstName,
      lastName,
      googleId: provider === 'google' ? id : undefined,
      facebookId: provider === 'facebook' ? id : undefined,
    }));

  if (!user.isActive) {
    throw new ValidationError({
      message: 'Account is deactivated',
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

  logger.info(logContext, 'SSO login successful', { provider, userId: user.userId });

  return {
    user,
    session: {
      ...currentSession,
      accessToken: accessTokenObj.token,
      refreshToken: refreshTokenObj.token,
    },
  };
};

