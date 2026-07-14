import { PropertyImageSelect, PropertyImageCreateInput, PropertyImageUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'PropertyImageRepository',
  function: '',
};

export const createPropertyImage = async (
  image: PropertyImageCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.propertyImage.create({ data: image }).catch(err => {
    logContext.function = 'createPropertyImage';
    logger.error(logContext, 'Error in createPropertyImage repository', { error: err });
    throw new Error('DB: property image create operation failed');
  });
};

export const findPropertyImageById = async (propertyImageId: string, select?: PropertyImageSelect) => {
  return await prisma.propertyImage.findUnique({
    where: { propertyImageId },
    select: select || {
      propertyImageId: true,
      url: true,
      alt: true,
      order: true,
      propertyId: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findPropertyImageById';
    logger.error(logContext, 'Error in findPropertyImageById repository', { error: err });
    throw new Error('DB: findPropertyImageById operation failed');
  });
};

export const findPropertyImagesByPropertyId = async (propertyId: string, select?: PropertyImageSelect) => {
  return await prisma.propertyImage.findMany({
    where: { propertyId },
    orderBy: { order: 'asc' },
    select: select || {
      propertyImageId: true,
      url: true,
      alt: true,
      order: true,
      propertyId: true,
    },
  }).catch(err => {
    logContext.function = 'findPropertyImagesByPropertyId';
    logger.error(logContext, 'Error in findPropertyImagesByPropertyId repository', { error: err });
    throw new Error('DB: findPropertyImagesByPropertyId operation failed');
  });
};

export const updatePropertyImage = async (
  propertyImageId: string,
  data: PropertyImageUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.propertyImage.update({
    where: { propertyImageId },
    data,
  }).catch(err => {
    logContext.function = 'updatePropertyImage';
    logger.error(logContext, 'Error in updatePropertyImage repository', { error: err });
    throw new Error('DB: property image update operation failed');
  });
};

export const deletePropertyImage = async (
  propertyImageId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.propertyImage.delete({
    where: { propertyImageId },
  }).catch(err => {
    logContext.function = 'deletePropertyImage';
    logger.error(logContext, 'Error in deletePropertyImage repository', { error: err });
    throw new Error('DB: property image delete operation failed');
  });
};
