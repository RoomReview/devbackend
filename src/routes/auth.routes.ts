import { Router } from 'express';
import * as authController from '@controllers/auth.controller';
import {
  RegisterUserDto,
  LoginUserDto,
  LogoutUserDto,
  VerifyEmailDto,
  VerifyEmailCodeDto,
  RefreshTokenDto,
  ResetPasswordDto,
  ForgotPasswordDto,
} from '@/dto/auth.dto';
import { validateRequest } from '@/middleware/validation.middleware';
import {
  requireMatchingUser,
  authenticate,
} from '@/middleware/auth.middleware';

const router = Router();

router.post(
  '/register',
  validateRequest({ body: RegisterUserDto }),
  authController.register,
);
router.post(
  '/login',
  validateRequest({ body: LoginUserDto }),
  authController.login,
);
router.post(
  '/logout',
  validateRequest({ body: LogoutUserDto }),
  authController.logout,
);
router.post(
  '/email/verify/reset',
  validateRequest({ body: VerifyEmailDto }),
  authController.emailVerifyReset,
);
router.get(
  '/email/verify',
  validateRequest({ query: VerifyEmailCodeDto }),
  authController.emailVerify,
);
router.post(
  '/refresh',
  validateRequest({ body: RefreshTokenDto }),
  authenticate,
  requireMatchingUser(['body.userId']),
  authController.refresh,
);
router.post(
  '/forgot-password',
  validateRequest({ body: ForgotPasswordDto }),
  authController.forgotPassword,
);
router.post(
  '/reset-password',
  validateRequest({ body: ResetPasswordDto }),
  authController.resetPassword,
);

router.get(
  '/me',
  authenticate,
  authController.getMe,
)

export default router;
