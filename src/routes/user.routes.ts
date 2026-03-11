import { Router } from 'express';
import * as userController from '@controllers/user.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, authorize('view:users:all'), userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

export default router;
