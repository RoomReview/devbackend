import { Router } from 'express';
import * as creditTransactionController from '@controllers/credit-transaction.controller';
import { authenticate } from '@/middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, creditTransactionController.getAllCreditTransactions);
router.get('/:id', authenticate, creditTransactionController.getCreditTransactionById);

export default router;
