/**
 * sso.routes.ts
 *
 * Routes for Google and Facebook OAuth login, callbacks, logout, and /me.
 * Mounted at /sso by the root router — full path is /api/v1/sso/...
 *
 * Flow overview:
 *   1. Browser visits GET /api/v1/sso/google
 *      → Passport redirects to Google
 *   2. Google redirects back to GET /api/v1/sso/google/callback
 *      → Passport runs strategy → loginOrRegisterSsoUser → ssoCallback
 *      → ssoCallback redirects to frontend with ?accessToken=&refreshToken=&userId=
 *   3. GET /api/v1/sso/logout  (requires Bearer token)
 *      → invalidates session
 *   4. GET /api/v1/sso/me      (requires Bearer token)
 *      → returns authenticated user profile
 */

import { Router } from 'express';
import passport from 'passport';
import * as ssoController from '../controllers/sso.controller';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '@middleware/auth.middleware';

const router = Router();

// ─── Google ────────────────────────────────────────────────────────────────

/** Initiates Google OAuth — redirects to Google consent screen */
router.get(
  '/google',
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] }),
);

/** Google OAuth callback — on success redirect to frontend, on failure redirect to error page */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/v1/sso/failure',
  }),
  ssoController.ssoCallback,
);

// ─── Facebook ──────────────────────────────────────────────────────────────

/** Initiates Facebook OAuth — redirects to Facebook login */
router.get(
  '/facebook',
  passport.authenticate('facebook', { session: false, scope: ['email'] }),
);

/** Facebook OAuth callback */
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', {
    session: false,
    failureRedirect: '/api/v1/sso/failure',
  }),
  ssoController.ssoCallback,
);

// ─── Shared ────────────────────────────────────────────────────────────────

/** OAuth failure landing — triggered by Passport failureRedirect */
router.get('/failure', ssoController.ssoFailure);

/** Invalidate current SSO session */
router.get('/logout', authenticate, ssoController.ssoLogout);

/**
 * Get authenticated SSO user profile (reuses the existing getMe handler).
 * Requires: Authorization: Bearer <accessToken>
 */
router.get('/me', authenticate, authController.getMe);

export default router;
