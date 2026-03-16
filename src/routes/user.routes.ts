import { Router } from 'express';
import * as userController from '@controllers/user.controller';
import { authenticate, authorize, requireMatchingUser } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { ChangePasswordDto } from '@/dto/user.dto';

const router = Router();

router.get('/', authenticate, authorize('view:users:all'), userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.post('/:userId/change-password', authenticate, validateRequest({ body: ChangePasswordDto }), requireMatchingUser(['params.userId']), userController.changePassword);

export default router;
