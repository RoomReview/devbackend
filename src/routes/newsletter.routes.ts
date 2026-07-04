import { Router } from 'express';
import * as newsletterController from '@controllers/newsletter.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { SubscribeNewsletterDto, ConfirmNewsletterDto } from '@/dto/newsletter.dto';

const router = Router();

router.post('/subscribe', validateRequest({ body: SubscribeNewsletterDto }), newsletterController.subscribe);
router.post('/confirm', validateRequest({ body: ConfirmNewsletterDto }), newsletterController.confirm);
router.delete('/unsubscribe/:email', newsletterController.unsubscribe);

router.get(
  '/subscribers',
  authenticate,
  authorize('view:users:all'),
  newsletterController.getAllSubscribers,
);

export default router;
