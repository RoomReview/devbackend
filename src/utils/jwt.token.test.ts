import { describe, it } from 'node:test';
import { equal, ok, throws, match } from 'node:assert';
import {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateToken,
  verifyToken,
} from './jwt.token.ts';
import { UnauthorizedError } from './custom-error.ts';
import { config } from '../config/index.ts';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validPayload = {
  sub: 'user-uuid-123',
  email: 'test@example.com',
  role: 'user',
};

// ─── generateAccessToken ──────────────────────────────────────────────────────

describe('jwt.token.service', () => {
  describe('generateAccessToken', () => {
    it('should return a three-part JWT string', () => {
      const token = generateAccessToken(validPayload);
      ok(typeof token.token === 'string' && token.token.length > 0);
      equal(token.token.split('.').length, 3);
    });

    it('should embed sub, email and role in the payload', () => {
      const token = generateAccessToken(validPayload);
      const decoded = verifyAccessToken(token.token);
      equal(decoded.sub, validPayload.sub);
      equal(decoded.email, validPayload.email);
      equal(decoded.role, validPayload.role);
    });

    it('should include numeric iat and exp claims', () => {
      const token = generateAccessToken(validPayload);
      const decoded = verifyAccessToken(token.token);
      ok(typeof decoded.iat === 'number');
      ok(typeof decoded.exp === 'number');
      ok(decoded.exp! > decoded.iat!);
    });

    it('should embed a non-empty jti (UUID v4 format)', () => {
      const token = generateAccessToken(validPayload);
      const decoded = verifyAccessToken(token.token);
      ok(typeof decoded.jti === 'string' && decoded.jti.length > 0);
      // UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      match(
        decoded.jti!,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should generate a unique jti for each call', () => {
      const t1 = verifyAccessToken(generateAccessToken(validPayload).token);
      const t2 = verifyAccessToken(generateAccessToken(validPayload).token);
      ok(t1.jti !== t2.jti, 'jti must be unique per token');
    });

    it('should embed the correct issuer (iss)', () => {
      const decoded = verifyAccessToken(
        generateAccessToken(validPayload).token,
      );
      equal(decoded.iss, config.jwtIssuer);
    });

    it('should embed the access-token audience (aud)', () => {
      const decoded = verifyAccessToken(
        generateAccessToken(validPayload).token,
      );
      const aud = decoded.aud;
      const expected = config.jwtAccessTokenAudience;
      // jsonwebtoken may return aud as string or string[]
      ok(aud === expected || (Array.isArray(aud) && aud.includes(expected)));
    });
  });

  // ─── verifyAccessToken ────────────────────────────────────────────────────────

  describe('verifyAccessToken', () => {
    it('should return the decoded payload for a valid access token', () => {
      const decoded = verifyAccessToken(
        generateAccessToken(validPayload).token,
      );
      equal(decoded.sub, validPayload.sub);
    });

    it('should throw UnauthorizedError when token is an empty string', () => {
      throws(
        () => verifyAccessToken(''),
        (err: unknown) => {
          ok(err instanceof UnauthorizedError);
          equal(err.statusCode, 401);
          return true;
        },
      );
    });

    it('should throw UnauthorizedError for a tampered / invalid token', () => {
      throws(
        () => verifyAccessToken('header.payload.invalidsig'),
        (err: unknown) => {
          ok(err instanceof UnauthorizedError);
          return true;
        },
      );
    });

    it('should throw UnauthorizedError for an expired access token', () => {
      const expiredToken = generateToken(validPayload, config.jwtSecret, {
        expiresIn: '0s',
        jwtid: crypto.randomUUID(),
        issuer: config.jwtIssuer,
        audience: config.jwtAccessTokenAudience,
      });
      throws(
        () => verifyAccessToken(expiredToken.token),
        (err: unknown) => {
          ok(err instanceof UnauthorizedError);
          return true;
        },
      );
    });

    it('should throw UnauthorizedError when verified with the wrong secret', () => {
      const token = generateToken(validPayload, 'secret-a', {
        expiresIn: '15m',
        issuer: config.jwtIssuer,
        audience: config.jwtAccessTokenAudience,
      });
      throws(
        () =>
          verifyToken(token.token, 'secret-b', {
            issuer: config.jwtIssuer,
            audience: config.jwtAccessTokenAudience,
          }),
        (err: unknown) => {
          ok(err instanceof UnauthorizedError);
          return true;
        },
      );
    });
  });

  // ─── generateRefreshToken ─────────────────────────────────────────────────────

  describe('generateRefreshToken', () => {
    it('should return a three-part JWT string', () => {
      const token = generateRefreshToken(validPayload);
      ok(typeof token.token === 'string' && token.token.length > 0);
      equal(token.token.split('.').length, 3);
    });

    it('should embed sub, email and role in the payload', () => {
      const decoded = verifyRefreshToken(
        generateRefreshToken(validPayload).token,
      );
      equal(decoded.sub, validPayload.sub);
      equal(decoded.email, validPayload.email);
      equal(decoded.role, validPayload.role);
    });

    it('should embed a non-empty jti (UUID v4 format)', () => {
      const decoded = verifyRefreshToken(
        generateRefreshToken(validPayload).token,
      );
      ok(typeof decoded.jti === 'string' && decoded.jti.length > 0);
      match(
        decoded.jti!,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should generate a unique jti for each call', () => {
      const t1 = verifyRefreshToken(generateRefreshToken(validPayload).token);
      const t2 = verifyRefreshToken(generateRefreshToken(validPayload).token);
      ok(t1.jti !== t2.jti, 'jti must be unique per token');
    });

    it('should embed the correct issuer (iss)', () => {
      const decoded = verifyRefreshToken(
        generateRefreshToken(validPayload).token,
      );
      equal(decoded.iss, config.jwtIssuer);
    });

    it('should embed the refresh-token audience (aud), distinct from access-token audience', () => {
      const decoded = verifyRefreshToken(
        generateRefreshToken(validPayload).token,
      );
      const aud = decoded.aud;
      const expected = config.jwtRefreshTokenAudience;
      ok(aud === expected || (Array.isArray(aud) && aud.includes(expected)));
      ok(aud !== config.jwtAccessTokenAudience);
    });

    it('should produce a token distinct from the access token for the same payload', () => {
      ok(
        generateAccessToken(validPayload) !==
        generateRefreshToken(validPayload),
      );
    });
  });

  // ─── verifyRefreshToken ───────────────────────────────────────────────────────

  describe('verifyRefreshToken', () => {
    it('should return the decoded payload for a valid refresh token', () => {
      const decoded = verifyRefreshToken(
        generateRefreshToken(validPayload).token,
      );
      equal(decoded.sub, validPayload.sub);
    });

    it('should throw UnauthorizedError when token is an empty string', () => {
      throws(
        () => verifyRefreshToken(''),
        (err: unknown) => {
          ok(err instanceof UnauthorizedError);
          equal((err as UnauthorizedError).statusCode, 401);
          return true;
        },
      );
    });

    it('should throw UnauthorizedError for a completely invalid token', () => {
      throws(
        () => verifyRefreshToken('not.a.jwt'),
        (err: unknown) => {
          ok(err instanceof UnauthorizedError);
          return true;
        },
      );
    });
  });

  // ─── cross-token isolation ────────────────────────────────────────────────────

  describe('cross-token secret & audience isolation', () => {
    it('should reject a refresh token when verifying as an access token (wrong secret)', () => {
      const refreshToken = generateRefreshToken(validPayload);
      throws(
        () => verifyAccessToken(refreshToken.token),
        (err: unknown) => {
          ok(err instanceof UnauthorizedError);
          return true;
        },
      );
    });

    it('should reject an access token when verifying as a refresh token (wrong secret)', () => {
      const accessToken = generateAccessToken(validPayload);
      throws(
        () => verifyRefreshToken(accessToken.token),
        (err: unknown) => {
          ok(err instanceof UnauthorizedError);
          return true;
        },
      );
    });

    it('should reject a token with matching secret but wrong audience', () => {
      // Sign with access secret but wrong (refresh) audience
      const sharedSecret = 'shared-secret';
      const tokenForAccess = generateToken(validPayload, sharedSecret, {
        expiresIn: '15m',
        issuer: config.jwtIssuer,
        audience: config.jwtRefreshTokenAudience, // ← wrong audience
      });
      throws(
        () =>
          verifyToken(tokenForAccess.token, sharedSecret, {
            issuer: config.jwtIssuer,
            audience: config.jwtAccessTokenAudience, // ← expected audience
          }),
        (err: unknown) => {
          ok(err instanceof UnauthorizedError);
          return true;
        },
      );
    });

    it('should reject a token with matching secret but wrong issuer', () => {
      const sharedSecret = 'shared-secret';
      const token = generateToken(validPayload, sharedSecret, {
        expiresIn: '15m',
        issuer: 'malicious-issuer', // ← wrong issuer
        audience: config.jwtAccessTokenAudience,
      });
      throws(
        () =>
          verifyToken(token.token, sharedSecret, {
            issuer: config.jwtIssuer, // ← expected issuer
            audience: config.jwtAccessTokenAudience,
          }),
        (err: unknown) => {
          ok(err instanceof UnauthorizedError);
          return true;
        },
      );
    });
  });
});
