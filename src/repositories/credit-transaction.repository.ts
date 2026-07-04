import { CreditTransactionSelect, CreditTransactionCreateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'CreditTransactionRepository',
  function: '',
};

export const createTransaction = async (
  transaction: CreditTransactionCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.creditTransaction.create({ data: transaction }).catch(err => {
    logContext.function = 'createTransaction';
    logger.error(logContext, 'Error in createTransaction repository', { error: err });
    throw new Error('DB: credit transaction create operation failed');
  });
};

export const findTransactionById = async (creditTransactionId: string, select?: CreditTransactionSelect) => {
  return await prisma.creditTransaction.findUnique({
    where: { creditTransactionId },
    select: select || {
      creditTransactionId: true,
      userCreditsId: true,
      amount: true,
      type: true,
      description: true,
      balanceAfter: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findTransactionById';
    logger.error(logContext, 'Error in findTransactionById repository', { error: err });
    throw new Error('DB: findTransactionById operation failed');
  });
};

export const findAllTransactionsByUserCreditsId = async (
  userCreditsId: string,
  limit: number,
  offset: number,
  select?: CreditTransactionSelect,
) => {
  return await prisma.creditTransaction.findMany({
    where: { userCreditsId },
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: select || {
      creditTransactionId: true,
      amount: true,
      type: true,
      description: true,
      balanceAfter: true,
      createdAt: true,
    },
  }).catch(err => {
    logContext.function = 'findAllTransactionsByUserCreditsId';
    logger.error(logContext, 'Error in findAllTransactionsByUserCreditsId repository', { error: err });
    throw new Error('DB: findAllTransactionsByUserCreditsId operation failed');
  });
};

export const countTransactionsByUserCreditsId = async (userCreditsId: string) => {
  return await prisma.creditTransaction.count({ where: { userCreditsId } }).catch(err => {
    logContext.function = 'countTransactionsByUserCreditsId';
    logger.error(logContext, 'Error in countTransactionsByUserCreditsId repository', { error: err });
    throw new Error('DB: countTransactionsByUserCreditsId operation failed');
  });
};
