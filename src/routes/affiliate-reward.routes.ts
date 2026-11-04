import { Router } from 'express';
import * as affiliateRewardController from '@/controllers/affiliate-reward.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { auditAdminAction } from '@/middleware/admin-audit.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateAffiliateOfferDto } from '@/dto/affiliate-reward.dto';
import { object, z } from 'zod';
import {
  SyncAwinOffersDto,
  SyncAwinTransactionsDto,
} from '@/dto/awin-transaction.dto';

const router = Router();

router.get('/mine', authenticate, affiliateRewardController.getRewardsProfile);
router.post(
  '/:rewardGrantId/redeem',
  authenticate,
  affiliateRewardController.redeemReward,
);

router.get(
  '/admin/offers',
  authenticate,
  authorize('manage:rewards'),
  auditAdminAction,
  affiliateRewardController.getAdminOffers,
);
router.post(
  '/admin/offers',
  authenticate,
  authorize('manage:rewards'),
  auditAdminAction,
  validateRequest({ body: CreateAffiliateOfferDto }),
  affiliateRewardController.createAdminOffer,
);
router.put(
  '/admin/offers/:offerId',
  authenticate,
  authorize('manage:rewards'),
  auditAdminAction,
  validateRequest({
    params: object({ offerId: z.uuid() }),
    body: CreateAffiliateOfferDto,
  }),
  affiliateRewardController.updateAdminOffer,
);
router.get(
  '/admin/awin/publishers',
  authenticate,
  authorize('manage:rewards'),
  auditAdminAction,
  affiliateRewardController.getAwinPublishers,
);
router.get(
  '/admin/awin/transactions',
  authenticate,
  authorize('manage:rewards'),
  auditAdminAction,
  affiliateRewardController.getAwinTransactionsForAdmin,
);
router.post(
  '/admin/awin/offers/sync',
  authenticate,
  authorize('manage:rewards'),
  auditAdminAction,
  validateRequest({ body: SyncAwinOffersDto }),
  affiliateRewardController.syncAwinOffersForAdmin,
);
router.post(
  '/admin/awin/sync',
  authenticate,
  authorize('manage:rewards'),
  auditAdminAction,
  validateRequest({ body: SyncAwinTransactionsDto }),
  affiliateRewardController.syncAwinTransactionsForAdmin,
);

export default router;
