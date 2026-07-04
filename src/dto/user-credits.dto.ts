import { SubscriptionPlan, TransactionType } from '@/generated/prisma/enums';
import {
  object,
  number,
  string,
  enum as enum_,
  type infer as _infer,
} from 'zod';

export const UpdateUserCreditsDto = object({
  creditsBalance: number().int().nonnegative().optional(),
  subscriptionPlan: enum_([
    SubscriptionPlan.FREE,
    SubscriptionPlan.BASIC,
    SubscriptionPlan.STANDARD,
    SubscriptionPlan.PRO,
    SubscriptionPlan.PREMIUM,
  ]).optional(),
  aiSummaryUsed: number().int().nonnegative().optional(),
  aiSummaryLimit: number().int().nonnegative().optional(),
  planExpiresAt: string().datetime().nullable().optional(),
});

export type UpdateUserCreditsDto = _infer<typeof UpdateUserCreditsDto>;

export const AdjustUserCreditsDto = object({
  amount: number().int(),
  type: enum_([
    TransactionType.BONUS,
    TransactionType.REFUND,
    TransactionType.PURCHASE,
    TransactionType.SUBSCRIPTION,
    TransactionType.DOWNLOAD,
    TransactionType.AI_SUMMARY,
    TransactionType.VALUATION,
  ]),
  description: string().min(1),
});

export type AdjustUserCreditsDto = _infer<typeof AdjustUserCreditsDto>;

