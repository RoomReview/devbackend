import { UserCreditsSelect, UserCreditsCreateInput, UserCreditsUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'UserCreditsRepository',
  function: '',
};

export const createUserCredits = async (
  credits: UserCreditsCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.userCredits.create({ data: credits }).catch(err => {
    logContext.function = 'createUserCredits';
    logger.error(logContext, 'Error in createUserCredits repository', { error: err });
    throw new Error('DB: user credits create operation failed');
  });
};

export const findUserCreditsByUserId = async (userId: string, select?: UserCreditsSelect) => {
  return await prisma.userCredits.findUnique({
    where: { userId },
    select: select || {
      userCreditsId: true,
      userId: true,
      creditsBalance: true,
      subscriptionPlan: true,
      aiSummaryUsed: true,
      aiSummaryLimit: true,
      planExpiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findUserCreditsByUserId';
    logger.error(logContext, 'Error in findUserCreditsByUserId repository', { error: err });
    throw new Error('DB: findUserCreditsByUserId operation failed');
  });
};

export const findUserCreditsById = async (userCreditsId: string, select?: UserCreditsSelect) => {
  return await prisma.userCredits.findUnique({
    where: { userCreditsId },
    select: select || {
      userCreditsId: true,
      userId: true,
      creditsBalance: true,
      subscriptionPlan: true,
      aiSummaryUsed: true,
      aiSummaryLimit: true,
      planExpiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findUserCreditsById';
    logger.error(logContext, 'Error in findUserCreditsById repository', { error: err });
    throw new Error('DB: findUserCreditsById operation failed');
  });
};

export const updateUserCredits = async (
  userCreditsId: string,
  data: UserCreditsUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.userCredits.update({
    where: { userCreditsId },
    data,
  }).catch(err => {
    logContext.function = 'updateUserCredits';
    logger.error(logContext, 'Error in updateUserCredits repository', { error: err });
    throw new Error('DB: user credits update operation failed');
  });
};

export const deleteUserCredits = async (
  userCreditsId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.userCredits.delete({
    where: { userCreditsId },
  }).catch(err => {
    logContext.function = 'deleteUserCredits';
    logger.error(logContext, 'Error in deleteUserCredits repository', { error: err });
    throw new Error('DB: user credits delete operation failed');
  });
};
