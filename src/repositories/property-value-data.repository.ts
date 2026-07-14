import { PropertyValueDataSelect, PropertyValueDataCreateInput, PropertyValueDataUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'PropertyValueDataRepository',
  function: '',
};

export const createPropertyValueData = async (
  val: PropertyValueDataCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.propertyValueData.create({ data: val }).catch(err => {
    logContext.function = 'createPropertyValueData';
    logger.error(logContext, 'Error in createPropertyValueData repository', { error: err });
    throw new Error('DB: property value data create operation failed');
  });
};

export const createManyPropertyValueData = async (
  data: PropertyValueDataCreateInput[],
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.propertyValueData.createMany({ data }).catch(err => {
    logContext.function = 'createManyPropertyValueData';
    logger.error(logContext, 'Error in createManyPropertyValueData repository', { error: err });
    throw new Error('DB: property value data bulk create operation failed');
  });
};

export const findPropertyValueDataById = async (propertyValueDataId: string, select?: PropertyValueDataSelect) => {
  return await prisma.propertyValueData.findUnique({
    where: { propertyValueDataId },
    select: select || {
      propertyValueDataId: true,
      postcode: true,
      averageValue: true,
      growthRate: true,
      salesVolume: true,
      recordedDate: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findPropertyValueDataById';
    logger.error(logContext, 'Error in findPropertyValueDataById repository', { error: err });
    throw new Error('DB: findPropertyValueDataById operation failed');
  });
};

export interface FindPropertyValueDataFilter {
  postcode?: string;
}

export const findAllPropertyValueData = async (
  limit: number,
  offset: number,
  filter?: FindPropertyValueDataFilter,
  select?: PropertyValueDataSelect,
) => {
  const where: any = {};
  if (filter?.postcode) where.postcode = filter.postcode;

  return await prisma.propertyValueData.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { recordedDate: 'desc' },
    select: select || {
      propertyValueDataId: true,
      postcode: true,
      averageValue: true,
      growthRate: true,
      salesVolume: true,
      recordedDate: true,
    },
  }).catch(err => {
    logContext.function = 'findAllPropertyValueData';
    logger.error(logContext, 'Error in findAllPropertyValueData repository', { error: err });
    throw new Error('DB: findAllPropertyValueData operation failed');
  });
};

export const countPropertyValueData = async (filter?: FindPropertyValueDataFilter) => {
  const where: any = {};
  if (filter?.postcode) where.postcode = filter.postcode;

  return await prisma.propertyValueData.count({ where }).catch(err => {
    logContext.function = 'countPropertyValueData';
    logger.error(logContext, 'Error in countPropertyValueData repository', { error: err });
    throw new Error('DB: countPropertyValueData operation failed');
  });
};

export const updatePropertyValueData = async (
  propertyValueDataId: string,
  data: PropertyValueDataUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.propertyValueData.update({
    where: { propertyValueDataId },
    data,
  }).catch(err => {
    logContext.function = 'updatePropertyValueData';
    logger.error(logContext, 'Error in updatePropertyValueData repository', { error: err });
    throw new Error('DB: property value data update operation failed');
  });
};

export const deletePropertyValueData = async (
  propertyValueDataId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.propertyValueData.delete({
    where: { propertyValueDataId },
  }).catch(err => {
    logContext.function = 'deletePropertyValueData';
    logger.error(logContext, 'Error in deletePropertyValueData repository', { error: err });
    throw new Error('DB: property value data delete operation failed');
  });
};
