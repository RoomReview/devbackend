import { Router } from 'express';
import * as newsletterController from '@controllers/newsletter.controller';
import {
  getEmailRateLimitKey,
  getRequestRateLimitKey,
  rateLimit,
} from '@/middleware/rateLimit.middleware';

const router = Router();

router.post(
  '/subscribe',
  rateLimit({
    name: 'newsletter-subscribe-ip',
    limit: 5,
    windowMs: 60 * 60 * 1000,
    key: getRequestRateLimitKey,
  }),
  rateLimit({
    name: 'newsletter-subscribe-email',
    limit: 3,
    windowMs: 60 * 60 * 1000,
    key: getEmailRateLimitKey,
  }),
  newsletterController.subscribe,
);
router.get('/confirm/:token', newsletterController.confirmSubscription);
router.get(
  '/unsubscribe/:token',
  newsletterController.showUnsubscribeConfirmation,
);
router.post('/unsubscribe/:token', newsletterController.unsubscribe);
router.post(
  '/webhooks/article-published',
  newsletterController.articlePublishedWebhook,
);

export default router;
