import { TransactionType } from '@/generated/prisma/enums';
import {
  object,
  string,
  number,
  enum as enum_,
  type infer as _infer,
} from 'zod';

export const CreateCreditTransactionDto = object({
  userId: string().uuid(),
  amount: number().int().positive(),
  type: enum_([
    TransactionType.PURCHASE,
    TransactionType.SUBSCRIPTION,
    TransactionType.DOWNLOAD,
    TransactionType.AI_SUMMARY,
    TransactionType.VALUATION,
    TransactionType.REFUND,
    TransactionType.BONUS,
  ]),
  description: string().min(1),
});

export type CreateCreditTransactionDto = _infer<typeof CreateCreditTransactionDto>;
