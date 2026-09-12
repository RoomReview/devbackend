import { Router } from 'express';
import { authenticate } from '@/middleware/auth.middleware';
import * as paymentController from '@/controllers/payment.controller';

const router = Router();

router.get('/orders', authenticate, paymentController.getOrderHistory);
router.get('/billing', authenticate, paymentController.getBilling);
router.post('/subscription/checkout', authenticate, paymentController.createSubscriptionCheckout);
router.post('/reports/:reportId/checkout', authenticate, paymentController.createCheckout);

export default router;