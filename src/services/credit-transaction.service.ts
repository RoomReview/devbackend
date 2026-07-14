import {
  findTransactionById,
  findAllTransactionsByUserCreditsId,
  countTransactionsByUserCreditsId,
} from '@/repositories/credit-transaction.repository';
import { getUserCreditsByUserId, deductCredits, addCredits } from '@/services/user-credits.service';
import { EntityNotFoundError } from '@/utils/custom-error';
import type { CreateCreditTransactionDto } from '@/dto/credit-transaction.dto';
import { paginate, buildPaginatedResult } from '@/utils/helpers';
import { TransactionType } from '@/generated/prisma/enums';

export const createCreditTransaction = async (data: CreateCreditTransactionDto) => {
  const isDebit = [
    TransactionType.DOWNLOAD,
    TransactionType.AI_SUMMARY,
    TransactionType.VALUATION,
  ].includes(data.type);

  if (isDebit) {
    return await deductCredits(data.userId, data.amount, data.type, data.description);
  } else {
    return await addCredits(data.userId, data.amount, data.type, data.description);
  }
};

export const getTransactionById = async (id: string) => {
  const tx = await findTransactionById(id);
  if (!tx) {
    throw new EntityNotFoundError({
      message: `Credit transaction with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return tx;
};

export const getUserTransactions = async (userId: string, page: number, limit: number) => {
  const credits = await getUserCreditsByUserId(userId);
  const { offset } = paginate(page, limit);
  const [items, total] = await Promise.all([
    findAllTransactionsByUserCreditsId(credits.userCreditsId, limit, offset),
    countTransactionsByUserCreditsId(credits.userCreditsId),
  ]);
  return buildPaginatedResult(items, total, page, limit);
};
