import { Router } from 'express';
import * as adminController from '@/controllers/admin.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { ModerateReviewDto } from '@/dto/review.dto';
import { auditAdminAction } from '@/middleware/admin-audit.middleware';

const router = Router();

router.get('/overview', authenticate, authorize('view:users:all'), auditAdminAction, adminController.getOverview);
router.get('/users', authenticate, authorize('view:users:all'), auditAdminAction, adminController.getUsers);
router.get('/audit-logs', authenticate, authorize('view:users:all'), auditAdminAction, adminController.getAuditLogs);
router.get('/reviews', authenticate, authorize('manage:reviews'), auditAdminAction, adminController.getReviews);
router.delete('/reviews/:reviewId', authenticate, authorize('manage:reviews'), auditAdminAction, adminController.deleteReview);
router.patch(
  '/reviews/:reviewId/moderation',
  authenticate,
  authorize('manage:reviews'),
  auditAdminAction,
  validateRequest({ body: ModerateReviewDto }),
  adminController.moderateReview,
);
router.post('/users/:userId/cancel-subscription', authenticate, authorize('manage:users'), auditAdminAction, adminController.cancelUserSubscription);
router.patch('/users/:userId/ban', authenticate, authorize('manage:users'), auditAdminAction, adminController.toggleUserBan);

export default router;
