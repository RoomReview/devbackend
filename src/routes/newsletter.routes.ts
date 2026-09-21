import { Router } from 'express';
import * as newsletterController from '@controllers/newsletter.controller';

const router = Router();

router.post('/subscribe', newsletterController.subscribe);
router.get('/confirm/:token', newsletterController.confirmSubscription);
router.post('/unsubscribe', newsletterController.unsubscribe);

export default router;
