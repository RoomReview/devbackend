/**
 * express.d.ts
 *
 * Augments the Express `User` namespace so that Passport's req.user type
 * is compatible with both our SsoTokenPayload (Passport callbacks) and
 * AuthenticatedRequest user shape (JWT authenticate middleware).
 *
 * Without this, TypeScript reports a type mismatch anywhere both
 * Passport-enhanced and JWT-enhanced handlers appear on the same route.
 */

declare global {
  namespace Express {
    interface User {
      /** OAuth / SSO token payload — set by Passport strategy callback */
      accessToken: string;
      refreshToken: string;
      /** Common user identity fields set by both SSO and JWT middleware */
      userId: string;
      email: string;
      role: string;
      accessTokenId?: string;
    }
  }
}

export {};
