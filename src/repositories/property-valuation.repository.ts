import { PropertyValuationSelect, PropertyValuationCreateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'PropertyValuationRepository',
  function: '',
};

export const createPropertyValuation = async (
  valuation: PropertyValuationCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.propertyValuation.create({ data: valuation }).catch(err => {
    logContext.function = 'createPropertyValuation';
    logger.error(logContext, 'Error in createPropertyValuation repository', { error: err });
    throw new Error('DB: property valuation create operation failed');
  });
};

export const findPropertyValuationById = async (propertyValuationId: string, select?: PropertyValuationSelect) => {
  return await prisma.propertyValuation.findUnique({
    where: { propertyValuationId },
    select: select || {
      propertyValuationId: true,
      userCreditsId: true,
      postcode: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      floorArea: true,
      yearBuilt: true,
      condition: true,
      currentValuation: true,
      forecastValuation: true,
      forecastDate: true,
      aiSummary: true,
      creditsUsed: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findPropertyValuationById';
    logger.error(logContext, 'Error in findPropertyValuationById repository', { error: err });
    throw new Error('DB: findPropertyValuationById operation failed');
  });
};

export const findAllPropertyValuationsByUserCreditsId = async (
  userCreditsId: string,
  limit: number,
  offset: number,
  select?: PropertyValuationSelect,
) => {
  return await prisma.propertyValuation.findMany({
    where: { userCreditsId },
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: select || {
      propertyValuationId: true,
      postcode: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      currentValuation: true,
      creditsUsed: true,
      createdAt: true,
    },
  }).catch(err => {
    logContext.function = 'findAllPropertyValuationsByUserCreditsId';
    logger.error(logContext, 'Error in findAllPropertyValuationsByUserCreditsId repository', { error: err });
    throw new Error('DB: findAllPropertyValuationsByUserCreditsId operation failed');
  });
};

export const countPropertyValuationsByUserCreditsId = async (userCreditsId: string) => {
  return await prisma.propertyValuation.count({ where: { userCreditsId } }).catch(err => {
    logContext.function = 'countPropertyValuationsByUserCreditsId';
    logger.error(logContext, 'Error in countPropertyValuationsByUserCreditsId repository', { error: err });
    throw new Error('DB: countPropertyValuationsByUserCreditsId operation failed');
  });
};
