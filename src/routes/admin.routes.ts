import { Router } from 'express';
import * as adminController from '@/controllers/admin.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { ModerateReviewDto } from '@/dto/review.dto';

const router = Router();

router.get('/overview', authenticate, authorize('view:users:all'), adminController.getOverview);
router.get('/users', authenticate, authorize('view:users:all'), adminController.getUsers);
router.get('/reviews', authenticate, authorize('manage:reviews'), adminController.getReviews);
router.delete('/reviews/:reviewId', authenticate, authorize('manage:reviews'), adminController.deleteReview);
router.patch(
  '/reviews/:reviewId/moderation',
  authenticate,
  authorize('manage:reviews'),
  validateRequest({ body: ModerateReviewDto }),
  adminController.moderateReview,
);
router.post('/users/:userId/cancel-subscription', authenticate, authorize('manage:users'), adminController.cancelUserSubscription);
router.patch('/users/:userId/ban', authenticate, authorize('manage:users'), adminController.toggleUserBan);

export default router;
