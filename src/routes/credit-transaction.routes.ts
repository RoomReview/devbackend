import { Router } from 'express';
import * as creditController from '@controllers/credit-transaction.controller';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { validateRequest } from '@/middleware/validation.middleware';
import { CreateCreditTransactionDto } from '@/dto/credit-transaction.dto';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('manage:credits'),
  validateRequest({ body: CreateCreditTransactionDto }),
  creditController.createTransaction,
);

router.get('/:id', creditController.getTransactionById);
router.get('/user/:userId', creditController.getUserTransactions);

export default router;
