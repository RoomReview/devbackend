import { AIInteractionSelect, AIInteractionCreateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'AIInteractionRepository',
  function: '',
};

export const createAIInteraction = async (
  interaction: AIInteractionCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.aIInteraction.create({ data: interaction }).catch(err => {
    logContext.function = 'createAIInteraction';
    logger.error(logContext, 'Error in createAIInteraction repository', { error: err });
    throw new Error('DB: AI interaction create operation failed');
  });
};

export const findAIInteractionById = async (aiInteractionId: string, select?: AIInteractionSelect) => {
  return await prisma.aIInteraction.findUnique({
    where: { aiInteractionId },
    select: select || {
      aiInteractionId: true,
      userCreditsId: true,
      query: true,
      response: true,
      postcode: true,
      borough: true,
      tokensUsed: true,
      creditsUsed: true,
      downloaded: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findAIInteractionById';
    logger.error(logContext, 'Error in findAIInteractionById repository', { error: err });
    throw new Error('DB: findAIInteractionById operation failed');
  });
};

export const findAllAIInteractionsByUserCreditsId = async (
  userCreditsId: string,
  limit: number,
  offset: number,
  select?: AIInteractionSelect,
) => {
  return await prisma.aIInteraction.findMany({
    where: { userCreditsId },
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: select || {
      aiInteractionId: true,
      query: true,
      response: true,
      postcode: true,
      borough: true,
      creditsUsed: true,
      createdAt: true,
    },
  }).catch(err => {
    logContext.function = 'findAllAIInteractionsByUserCreditsId';
    logger.error(logContext, 'Error in findAllAIInteractionsByUserCreditsId repository', { error: err });
    throw new Error('DB: findAllAIInteractionsByUserCreditsId operation failed');
  });
};

export const countAIInteractionsByUserCreditsId = async (userCreditsId: string) => {
  return await prisma.aIInteraction.count({ where: { userCreditsId } }).catch(err => {
    logContext.function = 'countAIInteractionsByUserCreditsId';
    logger.error(logContext, 'Error in countAIInteractionsByUserCreditsId repository', { error: err });
    throw new Error('DB: countAIInteractionsByUserCreditsId operation failed');
  });
};
