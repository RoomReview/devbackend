import {
  createPropertyValuation,
  findPropertyValuationById,
  findAllPropertyValuationsByUserCreditsId,
  countPropertyValuationsByUserCreditsId,
} from '@/repositories/property-valuation.repository';
import { getUserCreditsByUserId } from '@/services/user-credits.service';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import type { CreatePropertyValuationDto } from '@/dto/property-valuation.dto';
import { paginate } from '@/utils/helpers';
import { TransactionType, PropertyCondition } from '@/generated/prisma/enums';
import prisma from '@config/database';

export const logValuation = async (userId: string, data: CreatePropertyValuationDto) => {
  const credits = await getUserCreditsByUserId(userId);

  if (credits.creditsBalance < data.creditsUsed) {
    throw new ValidationError({
      message: `Insufficient credit balance. Available: ${credits.creditsBalance}, Required: ${data.creditsUsed}`,
      code: 'VALIDATION_ERROR',
    });
  }

  // Calculate Mock Valuation
  let baseVal = 300000 + (data.bedrooms * 50000) + (data.bathrooms * 20000);
  
  if (data.floorArea) {
    baseVal += data.floorArea * 250;
  }

  let multiplier = 1.0;
  switch (data.condition) {
    case PropertyCondition.NEW_BUILD:
      multiplier = 1.2;
      break;
    case PropertyCondition.EXCELLENT:
      multiplier = 1.1;
      break;
    case PropertyCondition.GOOD:
      multiplier = 1.05;
      break;
    case PropertyCondition.AVERAGE:
      multiplier = 1.0;
      break;
    case PropertyCondition.NEEDS_WORK:
      multiplier = 0.85;
      break;
    case PropertyCondition.RENOVATION_REQUIRED:
      multiplier = 0.7;
      break;
  }

  const currentVal = Math.round(baseVal * multiplier);
  const forecastVal = Math.round(currentVal * 1.05); // 5% projected growth
  const forecastDate = new Date();
  forecastDate.setFullYear(forecastDate.getFullYear() + 1); // 1 year out

  const conditionLabel = data.condition.toLowerCase().replace('_', ' ');
  const aiSummary = `The property at postcode ${data.postcode} is a ${data.bedrooms}-bed, ${data.bathrooms}-bath ${data.propertyType.toLowerCase()} in ${conditionLabel} condition. Based on local trends, the current estimated valuation is £${currentVal.toLocaleString()}, with a forecasted value of £${forecastVal.toLocaleString()} by ${forecastDate.toLocaleDateString()}.`;

  return await prisma.$transaction(async (tx) => {
    // 1. Deduct user credits
    const updatedCredits = await tx.userCredits.update({
      where: { userCreditsId: credits.userCreditsId },
      data: {
        creditsBalance: {
          decrement: data.creditsUsed,
        },
      },
    });

    // 2. Create transaction record
    await tx.creditTransaction.create({
      data: {
        userCredits: { connect: { userCreditsId: credits.userCreditsId } },
        amount: -data.creditsUsed,
        type: TransactionType.VALUATION,
        description: `Valuation request for postcode: ${data.postcode}`,
        balanceAfter: updatedCredits.creditsBalance,
      },
    });

    // 3. Create property valuation record
    return await tx.propertyValuation.create({
      data: {
        userCredits: { connect: { userCreditsId: credits.userCreditsId } },
        postcode: data.postcode,
        propertyType: data.propertyType,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        floorArea: data.floorArea,
        yearBuilt: data.yearBuilt,
        condition: data.condition,
        currentValuation: currentVal,
        forecastValuation: forecastVal,
        forecastDate,
        aiSummary,
        creditsUsed: data.creditsUsed,
      },
    });
  });
};

export const getValuationById = async (id: string) => {
  const valuation = await findPropertyValuationById(id);
  if (!valuation) {
    throw new EntityNotFoundError({
      message: `Property valuation with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return valuation;
};

export const getUserValuations = async (userId: string, page: number, limit: number) => {
  const credits = await getUserCreditsByUserId(userId);
  const { offset } = paginate(page, limit);
  const items = await findAllPropertyValuationsByUserCreditsId(credits.userCreditsId, limit, offset);
  const total = await countPropertyValuationsByUserCreditsId(credits.userCreditsId);
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
