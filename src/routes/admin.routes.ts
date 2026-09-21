import { Router } from 'express';
import * as adminController from '@/controllers/admin.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';

const router = Router();

router.get('/overview', authenticate, authorize('view:users:all'), adminController.getOverview);
router.get('/users', authenticate, authorize('view:users:all'), adminController.getUsers);
router.post('/users/:userId/cancel-subscription', authenticate, authorize('manage:users'), adminController.cancelUserSubscription);
router.patch('/users/:userId/ban', authenticate, authorize('manage:users'), adminController.toggleUserBan);

export default router;
