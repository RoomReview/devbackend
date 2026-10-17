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
      /** OAuth identity or JWT-authenticated user */
      userId: string;
      email: string;
      role: string;
      accessTokenId?: string;
    }
  }
}

export {};
