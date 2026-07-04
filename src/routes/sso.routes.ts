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

/**
 * @swagger
 * tags:
 *   name: SSO
 *   description: Single Sign-On operations (Google/Facebook OAuth)
 */

const router = Router();

/**
 * @swagger
 * /sso/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     tags: [SSO]
 *     responses:
 *       302:
 *         description: Redirects to Google login screen
 */
router.get(
  '/google',
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] }),
);

/**
 * @swagger
 * /sso/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [SSO]
 *     responses:
 *       302:
 *         description: Redirects to frontend with tokens on success
 */
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/v1/sso/failure',
  }),
  ssoController.ssoCallback,
);

/**
 * @swagger
 * /sso/facebook:
 *   get:
 *     summary: Initiate Facebook OAuth login
 *     tags: [SSO]
 *     responses:
 *       302:
 *         description: Redirects to Facebook login screen
 */
router.get(
  '/facebook',
  passport.authenticate('facebook', { session: false, scope: ['email'] }),
);

/**
 * @swagger
 * /sso/facebook/callback:
 *   get:
 *     summary: Facebook OAuth callback
 *     tags: [SSO]
 *     responses:
 *       302:
 *         description: Redirects to frontend with tokens on success
 */
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', {
    session: false,
    failureRedirect: '/api/v1/sso/failure',
  }),
  ssoController.ssoCallback,
);

/**
 * @swagger
 * /sso/failure:
 *   get:
 *     summary: SSO failure landing page
 *     tags: [SSO]
 *     responses:
 *       200:
 *         description: Renders failure message or redirects
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/failure', ssoController.ssoFailure);

/**
 * @swagger
 * /sso/logout:
 *   get:
 *     summary: SSO logout
 *     tags: [SSO]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/logout', authenticate, ssoController.ssoLogout);

/**
 * @swagger
 * /sso/me:
 *   get:
 *     summary: Get authenticated SSO user profile
 *     tags: [SSO]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/me', authenticate, authController.getMe);

export default router;
