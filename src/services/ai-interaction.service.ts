import {
  createAIInteraction,
  findAIInteractionById,
  findAllAIInteractionsByUserCreditsId,
  countAIInteractionsByUserCreditsId,
} from '@/repositories/ai-interaction.repository';
import { getUserCreditsByUserId } from '@/services/user-credits.service';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import type { CreateAIInteractionDto } from '@/dto/ai-interaction.dto';
import { paginate } from '@/utils/helpers';
import { TransactionType } from '@/generated/prisma/enums';
import prisma from '@config/database';

export const logInteraction = async (userId: string, data: CreateAIInteractionDto) => {
  const credits = await getUserCreditsByUserId(userId);

  // Check AI Summary usage limits
  if (credits.aiSummaryUsed >= credits.aiSummaryLimit) {
    throw new ValidationError({
      message: `AI Summary query limit reached. Used: ${credits.aiSummaryUsed}/${credits.aiSummaryLimit}`,
      code: 'VALIDATION_ERROR',
    });
  }

  // Check Credit balance limits
  if (credits.creditsBalance < data.creditsUsed) {
    throw new ValidationError({
      message: `Insufficient credit balance. Available: ${credits.creditsBalance}, Required: ${data.creditsUsed}`,
      code: 'VALIDATION_ERROR',
    });
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Deduct credits and increment AI summary counter
    const updatedCredits = await tx.userCredits.update({
      where: { userCreditsId: credits.userCreditsId },
      data: {
        creditsBalance: {
          decrement: data.creditsUsed,
        },
        aiSummaryUsed: {
          increment: 1,
        },
      },
    });

    // 2. Create transaction record if credits are used
    if (data.creditsUsed > 0) {
      await tx.creditTransaction.create({
        data: {
          userCredits: { connect: { userCreditsId: credits.userCreditsId } },
          amount: -data.creditsUsed,
          type: TransactionType.AI_SUMMARY,
          description: `AI interaction query: "${data.query.substring(0, 30)}..."`,
          balanceAfter: updatedCredits.creditsBalance,
        },
      });
    }

    // 3. Create AI Interaction log
    return await tx.aIInteraction.create({
      data: {
        userCredits: { connect: { userCreditsId: credits.userCreditsId } },
        query: data.query,
        response: data.response,
        postcode: data.postcode,
        borough: data.borough,
        tokensUsed: data.tokensUsed,
        creditsUsed: data.creditsUsed,
        downloaded: data.downloaded ?? false,
      },
    });
  });
};

export const getInteractionById = async (id: string) => {
  const interaction = await findAIInteractionById(id);
  if (!interaction) {
    throw new EntityNotFoundError({
      message: `AI interaction with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return interaction;
};

export const getUserInteractions = async (userId: string, page: number, limit: number) => {
  const credits = await getUserCreditsByUserId(userId);
  const { offset } = paginate(page, limit);
  const items = await findAllAIInteractionsByUserCreditsId(credits.userCreditsId, limit, offset);
  const total = await countAIInteractionsByUserCreditsId(credits.userCreditsId);
  const totalPages = Math.ceil(total / limit);

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};
