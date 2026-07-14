import {
  createUserCredits,
  findUserCreditsByUserId,
  findUserCreditsById,
  updateUserCredits,
} from '@/repositories/user-credits.repository';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import type { UpdateUserCreditsDto } from '@/dto/user-credits.dto';
import { SubscriptionPlan, TransactionType } from '@/generated/prisma/enums';
import prisma from '@config/database';

export const getUserCreditsByUserId = async (userId: string) => {
  let credits: any = await findUserCreditsByUserId(userId);
  if (!credits) {
    // Automatically create default free credits profile if none exists
    credits = await createUserCredits({
      user: { connect: { userId } },
      creditsBalance: 15,
      subscriptionPlan: SubscriptionPlan.FREE,
      aiSummaryUsed: 0,
      aiSummaryLimit: 5,
    });
  }
  return await checkAndResetExpiredSubscription(credits);
};

export const checkAndResetExpiredSubscription = async (credits: any) => {
  if (
    credits.subscriptionPlan !== SubscriptionPlan.FREE &&
    credits.planExpiresAt &&
    new Date(credits.planExpiresAt) < new Date()
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Reset user credits
      const updatedCredits = await tx.userCredits.update({
        where: { userCreditsId: credits.userCreditsId },
        data: {
          subscriptionPlan: SubscriptionPlan.FREE,
          aiSummaryLimit: 5,
          planExpiresAt: null,
        },
      });

      // 2. Log credit transaction
      await tx.creditTransaction.create({
        data: {
          userCredits: { connect: { userCreditsId: credits.userCreditsId } },
          amount: 0,
          type: TransactionType.SUBSCRIPTION,
          description: `Subscription tier ${credits.subscriptionPlan} expired. Reverted to Free plan.`,
          balanceAfter: updatedCredits.creditsBalance,
        },
      });

      return updatedCredits;
    });
  }
  return credits;
};

export const getUserCreditsById = async (id: string) => {
  const credits = await findUserCreditsById(id);
  if (!credits) {
    throw new EntityNotFoundError({
      message: `User credits with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return await checkAndResetExpiredSubscription(credits);
};


export const updateUserCreditsByUserId = async (userId: string, data: UpdateUserCreditsDto) => {
  const credits = await getUserCreditsByUserId(userId); // Auto-creates if missing

  const updateData: any = {
    creditsBalance: data.creditsBalance,
    subscriptionPlan: data.subscriptionPlan,
    aiSummaryUsed: data.aiSummaryUsed,
    aiSummaryLimit: data.aiSummaryLimit,
    planExpiresAt: data.planExpiresAt !== undefined ? (data.planExpiresAt ? new Date(data.planExpiresAt) : null) : undefined,
  };

  return await updateUserCredits(credits.userCreditsId, updateData);
};

export const deductCredits = async (
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
) => {
  const credits = await getUserCreditsByUserId(userId);
  const positiveAmount = Math.abs(amount);

  if (credits.creditsBalance < positiveAmount) {
    throw new ValidationError({
      message: `Insufficient credit balance. Available: ${credits.creditsBalance}, Required: ${positiveAmount}`,
      code: 'VALIDATION_ERROR',
    });
  }

  return await prisma.$transaction(async (tx) => {
    // Deduct credits
    const updatedCredits = await tx.userCredits.update({
      where: { userCreditsId: credits.userCreditsId },
      data: {
        creditsBalance: {
          decrement: positiveAmount,
        },
      },
    });

    // Create negative amount transaction (debit)
    await tx.creditTransaction.create({
      data: {
        userCredits: { connect: { userCreditsId: credits.userCreditsId } },
        amount: -positiveAmount,
        type,
        description,
        balanceAfter: updatedCredits.creditsBalance,
      },
    });

    return updatedCredits;
  });
};

export const addCredits = async (
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
) => {
  const credits = await getUserCreditsByUserId(userId);
  const positiveAmount = Math.abs(amount);

  return await prisma.$transaction(async (tx) => {
    // Add credits
    const updatedCredits = await tx.userCredits.update({
      where: { userCreditsId: credits.userCreditsId },
      data: {
        creditsBalance: {
          increment: positiveAmount,
        },
      },
    });

    // Create positive amount transaction (credit)
    await tx.creditTransaction.create({
      data: {
        userCredits: { connect: { userCreditsId: credits.userCreditsId } },
        amount: positiveAmount,
        type,
        description,
        balanceAfter: updatedCredits.creditsBalance,
      },
    });

    return updatedCredits;
  });
};

export const adjustUserCredits = async (
  userId: string,
  amount: number,
  type: TransactionType,
  description: string,
) => {
  if (amount < 0) {
    return await deductCredits(userId, amount, type, description);
  } else {
    return await addCredits(userId, amount, type, description);
  }
};

