import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'SavedPropertyRepository',
  function: '',
};

export const saveProperty = async (userId: string, propertyId: string) => {
  return await prisma.savedProperty.create({
    data: {
      userId,
      propertyId,
    },
  }).catch(err => {
    logContext.function = 'saveProperty';
    logger.error(logContext, 'Error in saveProperty repository', { error: err });
    throw new Error('DB: saveProperty operation failed');
  });
};

export const findSavedProperty = async (userId: string, propertyId: string) => {
  return await prisma.savedProperty.findUnique({
    where: {
      userId_propertyId: {
        userId,
        propertyId,
      },
    },
  }).catch(err => {
    logContext.function = 'findSavedProperty';
    logger.error(logContext, 'Error in findSavedProperty repository', { error: err });
    throw new Error('DB: findSavedProperty operation failed');
  });
};

export const findSavedPropertiesByUserId = async (
  userId: string,
  limit: number,
  offset: number,
) => {
  return await prisma.savedProperty.findMany({
    where: { userId },
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: {
      savedPropertyId: true,
      propertyId: true,
      createdAt: true,
      property: {
        select: {
          propertyId: true,
          title: true,
          description: true,
          type: true,
          listingType: true,
          price: true,
          priceFrequency: true,
          bedrooms: true,
          bathrooms: true,
          address: true,
          status: true,
          images: {
            take: 1,
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  }).catch(err => {
    logContext.function = 'findSavedPropertiesByUserId';
    logger.error(logContext, 'Error in findSavedPropertiesByUserId repository', { error: err });
    throw new Error('DB: findSavedPropertiesByUserId operation failed');
  });
};

export const countSavedPropertiesByUserId = async (userId: string) => {
  return await prisma.savedProperty.count({
    where: { userId },
  }).catch(err => {
    logContext.function = 'countSavedPropertiesByUserId';
    logger.error(logContext, 'Error in countSavedPropertiesByUserId repository', { error: err });
    throw new Error('DB: countSavedPropertiesByUserId operation failed');
  });
};

export const deleteSavedProperty = async (userId: string, propertyId: string) => {
  return await prisma.savedProperty.delete({
    where: {
      userId_propertyId: {
        userId,
        propertyId,
      },
    },
  }).catch(err => {
    logContext.function = 'deleteSavedProperty';
    logger.error(logContext, 'Error in deleteSavedProperty repository', { error: err });
    throw new Error('DB: deleteSavedProperty operation failed');
  });
};
