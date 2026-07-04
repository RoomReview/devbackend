import { Router } from 'express';
import * as creditsController from '@controllers/user-credits.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { UpdateUserCreditsDto, AdjustUserCreditsDto } from '@/dto/user-credits.dto';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /user-credits/user/{userId}:
 *   get:
 *     summary: GET User Credits
 *     tags: [User Credits]
 *     parameters:
 *       - in: path
 *         name: userId
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
router.get('/user/:userId', creditsController.getUserCredits);

/**
 * @swagger
 * /user-credits/user/{userId}:
 *   put:
 *     summary: PUT User Credits
 *     tags: [User Credits]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
router.put(
  '/user/:userId',
  authorize('manage:credits'),
  validateRequest({ body: UpdateUserCreditsDto }),
  creditsController.updateUserCredits,
);

/**
 * @swagger
 * /user-credits/user/{userId}/adjust:
 *   post:
 *     summary: POST User Credits
 *     tags: [User Credits]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
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
router.post(
  '/user/:userId/adjust',
  authorize('manage:credits'),
  validateRequest({ body: AdjustUserCreditsDto }),
  creditsController.adjustUserCredits,
);

export default router;
