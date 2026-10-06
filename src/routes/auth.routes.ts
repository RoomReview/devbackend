import { Router } from 'express';
import * as authController from '@controllers/auth.controller';
import {
  RegisterUserDto,
  EarlyAccessRegisterDto,
  LoginUserDto,
  LogoutUserDto,
  VerifyEmailDto,
  VerifyEmailCodeDto,
  RefreshTokenDto,
  ResetPasswordDto,
  ForgotPasswordDto,
} from '@/dto/auth.dto';
import { validateRequest } from '@/middleware/validation.middleware';
import { getEmailRateLimitKey, getRequestRateLimitKey, rateLimit } from '@/middleware/rateLimit.middleware';
import { authenticate } from '@/middleware/auth.middleware';

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication and authorization management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     EarlyAccessRegisterDto:
 *       type: object
 *       required: [firstName, lastName, email, password]
 *       properties:
 *         firstName:
 *            type: string
 minLength: 64
 maxLength: 64
 pattern: '^[a-f0-9]{64}$'
 description: Single-use, high-entropy password-reset token.
 *         lastName:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 8
 *     RegisterUserDto:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *         - role
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 6
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         role:
 *           type: string
 *           enum: [LANDLORD, TENANT, AGENCY, AGENT]
 *         agencyName:
 *           type: string
 *         agencyDescription:
 *           type: string
 *         agencyEmail:
 *           type: string
 *         agencyPhone:
 *           type: string
 *         agencyWebsite:
 *           type: string
 *     LoginUserDto:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         statusCode:
 *           type: number
 *         message:
 *           type: string
 *         data:
 *           type: object
 *         error:
 *           type: string
 */

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterUserDto'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Bad request
 */
router.post(
  '/register',
  validateRequest({ body: RegisterUserDto }),
  rateLimit({ name: 'auth-register-ip', limit: 10, windowMs: 15 * 60 * 1000, key: getRequestRateLimitKey }),
  authController.register,
);

/**
 * @swagger
 * /auth/early-access:
 *   post:
 *     summary: Register for early access with an active 30-day trial
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EarlyAccessRegisterDto'
 *     responses:
 *       201:
 *         description: Account created with an active session and trial
 *       400:
 *         description: Invalid input or disposable email domain
 */
router.post(
  '/early-access',
  validateRequest({ body: EarlyAccessRegisterDto }),
  rateLimit({ name: 'auth-early-access-ip', limit: 10, windowMs: 15 * 60 * 1000, key: getRequestRateLimitKey }),
  authController.registerEarlyAccess,
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginUserDto'
 *     responses:
 *       200:
 *         description: User logged in successfully
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/login',
  validateRequest({ body: LoginUserDto }),
  rateLimit({ name: 'auth-login-ip', limit: 20, windowMs: 5 * 60 * 1000, key: getRequestRateLimitKey }),
  rateLimit({ name: 'auth-login-account', limit: 10, windowMs: 15 * 60 * 1000, key: getEmailRateLimitKey }),
  authController.login,
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: User logged out successfully
 */
router.post(
  '/logout',
  validateRequest({ body: LogoutUserDto }),
  authController.logout,
);

/**
 * @swagger
 * /auth/email/verify/reset:
 *   post:
 *     summary: Request a new email verification code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       201:
 *         description: Verification code sent successfully
 */
router.post(
  '/email/verify/reset',
  validateRequest({ body: VerifyEmailDto }),
  rateLimit({ name: 'verify-reset-ip', limit: 3, windowMs: 15 * 60 * 1000, key: getRequestRateLimitKey }),
  rateLimit({ name: 'verify-reset-account', limit: 3, windowMs: 15 * 60 * 1000, key: getEmailRateLimitKey }),
  authController.emailVerifyReset,
);

/**
 * @swagger
 * /auth/email/verify:
 *   get:
 *     summary: Verify email with a code
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 6
 *           maxLength: 6
 *           pattern: '^[0-9]{6}$'
 *     responses:
 *       200:
 *         description: Email verified successfully
 */
router.get(
  '/email/verify',
  validateRequest({ query: VerifyEmailCodeDto }),
  authController.emailVerify,
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Access token refreshed successfully
 */
router.post(
  '/refresh',
  validateRequest({ body: RefreshTokenDto }),
  authController.refresh,
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: If the email exists, a password reset code has been sent.
 */
router.post(
  '/forgot-password',
  validateRequest({ body: ForgotPasswordDto }),
  rateLimit({ name: 'forgot-password-ip', limit: 3, windowMs: 15 * 60 * 1000, key: getRequestRateLimitKey }),
  rateLimit({ name: 'forgot-password-account', limit: 3, windowMs: 15 * 60 * 1000, key: getEmailRateLimitKey }),
  authController.forgotPassword,
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with a code
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.post(
  '/reset-password',
  validateRequest({ body: ResetPasswordDto }),
  rateLimit({ name: 'reset-password-ip', limit: 10, windowMs: 15 * 60 * 1000, key: getRequestRateLimitKey }),
  rateLimit({ name: 'reset-password-account', limit: 5, windowMs: 15 * 60 * 1000, key: getEmailRateLimitKey }),
  authController.resetPassword,
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get currently authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User fetched successfully
 */
router.get(
  '/me',
  authenticate,
  authController.getMe,
)

export default router;
