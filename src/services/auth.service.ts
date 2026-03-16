import { RegisterUserDto, VerifyEmailCodeDto } from '@/dto/auth.dto';
import {
  createUser,
  findUserByEmail,
  getUserSensitiveByEmail,
} from './user.service';
import { comparePassword, hashPassword } from '../utils/password';
import { generateVerificationCode, verifyCode, isCodeExpired } from '../utils/token';
import {
  findUserSessionByAccessTokenId,
  findUserSessionByRefreshTokenId,
  logoutSessionByUserId,
  updateSessionAccessTokenId,
  upsertSession,
} from '@/repositories/sessions.repository';
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../utils/jwt.token';
import logger, { LogContext } from '@/utils/logger';
import { EntityNotFoundError, UnauthorizedError, ValidationError } from '@utils/custom-error';
import {
  findUserByVerifyCodeHash,
  updateUserVerifyCode,
  verifyUserEmail as verifyUserEmailRepo,
} from '@/repositories/users.repository';
import crypto from 'node:crypto';

const logContext: LogContext = {
  service: 'auth.service',
  function: ''
}

export const registerUser = async (data: RegisterUserDto) => {
  logContext.function = 'registerUser';
  // is user already exist
  const existingUser = await findUserByEmail(data.email);
  console.log('existingUser', existingUser);
  if (existingUser) {
    return { user: existingUser, session: {}, isExistingUser: true };
  }

  // hash password
  const hashedPassword = await hashPassword(data.password);

  // generate verification token
  const token = generateVerificationCode();

  logger.info(logContext, 'Verification token generated', { token });

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

  // TODO: send the verification email with code

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

  if (!(await comparePassword(password, user.passwordHash))) {
    throw new UnauthorizedError({
      message: 'Invalid credentials',
      code: 'VALIDATION_ERROR',
    });
  }

  const accessTokenObj = generateAccessToken({ email: user.email, sub: user.userId, role: user.role });

  const refreshTokenObj = generateRefreshToken({ email: user.email, sub: user.userId, role: user.role });

  // TBD: Does application allow multiple sessions? If not, we can update the existing session instead of creating new one
  const currentSession = await upsertSession({ userId: user.userId, accessTokenId: accessTokenObj?.jti ?? null, refreshTokenId: refreshTokenObj?.jti ?? null, accessTokenExpiry: accessTokenObj.expiresAt ?? null, refreshTokenExpiry: refreshTokenObj.expiresAt ?? null });

  return { user: userWithoutPassword, session: { ...currentSession, accessToken: accessTokenObj.token, refreshToken: refreshTokenObj.token } };
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
  logger.info(logContext, 'Verification code reset — dev-only log', { email, code: token.code });

  return { isNewCodeGenerated: true };
};

export const verifyEmail = async (data: VerifyEmailCodeDto) => {
  logContext.function = 'verifyEmail';
  const { code, email } = data;

  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

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

export const refreshAccessToken = async (userId: string, refreshToken: string) => {
  logContext.function = 'refreshAccessToken';

  // Verify signature, expiry, issuer & audience — throws UnauthorizedError on failure
  const { sub, email, role, jti } = verifyRefreshToken(refreshToken);

  // Defence-in-depth: confirm JWT subject matches the supplied userId
  if (sub !== userId) {
    throw new UnauthorizedError({ message: 'Token does not match the provided userId' });
  }

  if (!jti) {
    throw new UnauthorizedError({ message: 'Invalid refresh token: missing jti' });
  }

  // Look up live session — absence means the token was revoked or never stored
  const session = await findUserSessionByRefreshTokenId(jti, userId);
  if (!session) {
    throw new UnauthorizedError({ message: 'Refresh token is not recognised or has been revoked' });
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

  return { accessToken: accessTokenObj.token, expiresAt: accessTokenObj.expiresAt };
};