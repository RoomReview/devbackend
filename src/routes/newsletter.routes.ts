import { Router } from 'express';
import * as newsletterController from '@controllers/newsletter.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { SubscribeNewsletterDto, ConfirmNewsletterDto } from '@/dto/newsletter.dto';

const router = Router();

/**
 * @swagger
 * /newsletter/subscribe:
 *   post:
 *     summary: POST Newsletter
 *     tags: [Newsletter]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.post('/subscribe', validateRequest({ body: SubscribeNewsletterDto }), newsletterController.subscribe);
/**
 * @swagger
 * /newsletter/confirm:
 *   post:
 *     summary: POST Newsletter
 *     tags: [Newsletter]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.post('/confirm', validateRequest({ body: ConfirmNewsletterDto }), newsletterController.confirm);
/**
 * @swagger
 * /newsletter/unsubscribe/{email}:
 *   delete:
 *     summary: DELETE Newsletter
 *     tags: [Newsletter]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.delete('/unsubscribe/:email', newsletterController.unsubscribe);

/**
 * @swagger
 * /newsletter/subscribers:
 *   get:
 *     summary: GET Newsletter
 *     tags: [Newsletter]
 *     responses:
 *       200:
 *         description: Successful response
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/subscribers',
  authenticate,
  authorize('view:users:all'),
  newsletterController.getAllSubscribers,
);

export default router;
