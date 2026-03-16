import { Router } from 'express';
import * as authController from '@controllers/auth.controller';
import { RegisterUserDto, LoginUserDto, LogoutUserDto, VerifyEmailDto, VerifyEmailCodeDto, RefreshTokenDto } from '@/dto/auth.dto';
import { validateRequest } from '@/middleware/validation.middleware';
import { requireBodyUserMatch } from '@/middleware/auth.middleware';

const router = Router();

router.post('/register', validateRequest({ body: RegisterUserDto }), authController.register);
router.post('/login', validateRequest({ body: LoginUserDto }), authController.login);
router.post('/logout', validateRequest({ body: LogoutUserDto }), authController.logout);
router.post('/email/verify/reset', validateRequest({ body: VerifyEmailDto }), authController.emailVerifyReset);
router.get('/email/verify', validateRequest({ query: VerifyEmailCodeDto }), authController.emailVerify);
router.post('/refresh', validateRequest({ body: RefreshTokenDto }), requireBodyUserMatch, authController.refresh);

export default router;
