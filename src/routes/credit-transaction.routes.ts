import { Router } from 'express';
import * as creditController from '@controllers/credit-transaction.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateCreditTransactionDto } from '@/dto/credit-transaction.dto';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /credits:
 *   post:
 *     summary: POST Credit Transaction
 *     tags: [Credit Transaction]
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
  '/',
  authorize('manage:credits'),
  validateRequest({ body: CreateCreditTransactionDto }),
  creditController.createTransaction,
);

/**
 * @swagger
 * /credits/{id}:
 *   get:
 *     summary: GET Credit Transaction
 *     tags: [Credit Transaction]
 *     parameters:
 *       - in: path
 *         name: id
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
router.get('/:id', creditController.getTransactionById);
/**
 * @swagger
 * /credits/user/{userId}:
 *   get:
 *     summary: GET Credit Transaction
 *     tags: [Credit Transaction]
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
router.get('/user/:userId', creditController.getUserTransactions);

export default router;
