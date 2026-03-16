import crypto from 'node:crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '@config/index';
import {
  UnauthorizedError,
  InternalServerError,
  ErrorCodes,
} from '@utils/custom-error';
import logger, { LogContext } from '@utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Claims embedded into every signed JWT. */
export interface JwtPayload {
  sub: string;    // userId (RFC 7519 subject)
  email: string;
  role: string;
  jti?: string;   // unique token ID  (RFC 7519 JWT ID)
  iss?: string;   // issuer           (RFC 7519 issuer)
  aud?: string | string[]; // audience (RFC 7519 audience)
  iat?: number;
  exp?: number;
}

/** Subset a caller must supply — the rest is injected automatically. */
type TokenInput = Pick<JwtPayload, 'sub' | 'email' | 'role'>;

// ─── Internal helpers ─────────────────────────────────────────────────────────

const logContext: LogContext = {
  service: 'JwtTokenService',
  function: '',
};

// ─── Low-level sign / verify ──────────────────────────────────────────────────

/**
 * Low-level sign wrapper. Accepts an explicit `SignOptions` so callers can
 * inject `jwtid`, `issuer`, `audience`, and `expiresIn` in one shot.
 *
 * Prefer the typed helpers (`generateAccessToken` / `generateRefreshToken`).
 * - HS256:    HMAC using SHA-256 hash algorithm (default)
 */
export const generateToken = (
  payload: TokenInput,
  secret: string,
  options: jwt.SignOptions,
) => {
  logContext.function = 'generateToken';
  logger.info(logContext, 'Generating JWT token', { sub: payload.sub });
  const token = jwt.sign(payload, secret, options);
  const decoded = jwt.decode(token) as { exp?: number };
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : undefined;
  return { token, jti: options.jwtid, expiresAt, expiresIn: options.expiresIn };
};

/**
 * Low-level verify wrapper. Pass `VerifyOptions` with `issuer` / `audience`
 * to let `jsonwebtoken` validate those claims automatically.
 *
 * Throws `UnauthorizedError` (401) for missing / invalid / expired tokens,
 * or `InternalServerError` (500) for unexpected failures.
 */
export const verifyToken = (
  token: string,
  secret: string,
  options: jwt.VerifyOptions = {},
): JwtPayload => {
  logContext.function = 'verifyToken';

  if (!token) {
    throw new UnauthorizedError({
      message: 'Token is required',
      code: ErrorCodes.VALIDATION_ERROR,
    });
  }

  try {
    const decoded = jwt.verify(token, secret, options) as JwtPayload;
    logger.info(logContext, 'JWT token verified', { sub: decoded.sub, jti: decoded.jti });
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.info(logContext, 'JWT token expired', { error });
      throw new UnauthorizedError({
        message: 'Token has expired',
        code: ErrorCodes.VALIDATION_ERROR,
        data: { reason: 'TOKEN_EXPIRED' },
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      logger.info(logContext, 'JWT token invalid', { error });
      throw new UnauthorizedError({
        message: 'Invalid token',
        code: ErrorCodes.VALIDATION_ERROR,
        data: { reason: 'TOKEN_INVALID' },
      });
    }

    logger.error(logContext, 'Unexpected error during JWT verification', { error });
    throw new InternalServerError({
      message: 'Token verification failed',
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
    });
  }
};

// ─── Access token ─────────────────────────────────────────────────────────────

/**
 * Signs a short-lived access token.
 *
 * Injected claims:
 *   - `jti`  unique UUID v4 per token
 *   - `iss`  `config.jwtIssuer`                   (e.g. "roomreview-api")
 *   - `aud`  `config.jwtAccessTokenAudience`       (e.g. "roomreview-client")
 *   - `exp`  `config.jwtExpiresIn`                 (default 15 m)
 */
export const generateAccessToken = (payload: TokenInput) => {
  logContext.function = 'generateAccessToken';
  logger.info(logContext, 'Generating access token', { sub: payload.sub });

  return generateToken(payload, config.jwtSecret, {
    expiresIn: (config.jwtExpiresIn as SignOptions['expiresIn']),
    jwtid: crypto.randomUUID(),
    issuer: config.jwtIssuer,
    audience: config.jwtAccessTokenAudience,
  });
};

/**
 * Verifies an access token, including `iss` and `aud` claim validation.
 * Throws `UnauthorizedError` (401) for any failure.
 */
export const verifyAccessToken = (token: string): JwtPayload => {
  logContext.function = 'verifyAccessToken';
  logger.info(logContext, 'Verifying access token');

  return verifyToken(token, config.jwtSecret, {
    issuer: config.jwtIssuer,
    audience: config.jwtAccessTokenAudience,
  });
};

// ─── Refresh token ────────────────────────────────────────────────────────────

/**
 * Signs a long-lived refresh token.
 *
 * Injected claims:
 *   - `jti`  unique UUID v4 per token
 *   - `iss`  `config.jwtIssuer`                   (e.g. "roomreview-api")
 *   - `aud`  `config.jwtRefreshTokenAudience`      (e.g. "roomreview-auth")
 *   - `exp`  `config.jwtRefreshTokenExpiresIn`     (default 30 d)
 */
export const generateRefreshToken = (payload: TokenInput) => {
  logContext.function = 'generateRefreshToken';
  logger.info(logContext, 'Generating refresh token', { sub: payload.sub });

  return generateToken(payload, config.jwtRefreshTokenSecret, {
    expiresIn: config.jwtRefreshTokenExpiresIn as SignOptions['expiresIn'],
    jwtid: crypto.randomUUID(),
    issuer: config.jwtIssuer,
    audience: config.jwtRefreshTokenAudience,
  });
};

/**
 * Verifies a refresh token, including `iss` and `aud` claim validation.
 * Throws `UnauthorizedError` (401) for any failure.
 */
export const verifyRefreshToken = (token: string): JwtPayload => {
  logContext.function = 'verifyRefreshToken';
  logger.info(logContext, 'Verifying refresh token');

  return verifyToken(token, config.jwtRefreshTokenSecret, {
    issuer: config.jwtIssuer,
    audience: config.jwtRefreshTokenAudience,
  });
};