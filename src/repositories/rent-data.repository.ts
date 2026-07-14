import { RentDataSelect, RentDataCreateInput, RentDataUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'RentDataRepository',
  function: '',
};

export const createRentData = async (
  rent: RentDataCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.rentData.create({ data: rent }).catch(err => {
    logContext.function = 'createRentData';
    logger.error(logContext, 'Error in createRentData repository', { error: err });
    throw new Error('DB: rent data create operation failed');
  });
};

export const createManyRentData = async (
  data: RentDataCreateInput[],
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.rentData.createMany({ data }).catch(err => {
    logContext.function = 'createManyRentData';
    logger.error(logContext, 'Error in createManyRentData repository', { error: err });
    throw new Error('DB: rent data bulk create operation failed');
  });
};

export const findRentDataById = async (rentDataId: string, select?: RentDataSelect) => {
  return await prisma.rentData.findUnique({
    where: { rentDataId },
    select: select || {
      rentDataId: true,
      postcode: true,
      propertyType: true,
      bedrooms: true,
      averageRent: true,
      minRent: true,
      maxRent: true,
      sampleSize: true,
      recordedDate: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findRentDataById';
    logger.error(logContext, 'Error in findRentDataById repository', { error: err });
    throw new Error('DB: findRentDataById operation failed');
  });
};

export interface FindRentDataFilter {
  postcode?: string;
  propertyType?: string;
  bedrooms?: number;
}

export const findAllRentData = async (
  limit: number,
  offset: number,
  filter?: FindRentDataFilter,
  select?: RentDataSelect,
) => {
  const where: any = {};
  if (filter?.postcode) where.postcode = filter.postcode;
  if (filter?.propertyType) where.propertyType = filter.propertyType;
  if (filter?.bedrooms !== undefined) where.bedrooms = filter.bedrooms;

  return await prisma.rentData.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { recordedDate: 'desc' },
    select: select || {
      rentDataId: true,
      postcode: true,
      propertyType: true,
      bedrooms: true,
      averageRent: true,
      recordedDate: true,
    },
  }).catch(err => {
    logContext.function = 'findAllRentData';
    logger.error(logContext, 'Error in findAllRentData repository', { error: err });
    throw new Error('DB: findAllRentData operation failed');
  });
};

export const countRentData = async (filter?: FindRentDataFilter) => {
  const where: any = {};
  if (filter?.postcode) where.postcode = filter.postcode;
  if (filter?.propertyType) where.propertyType = filter.propertyType;
  if (filter?.bedrooms !== undefined) where.bedrooms = filter.bedrooms;

  return await prisma.rentData.count({ where }).catch(err => {
    logContext.function = 'countRentData';
    logger.error(logContext, 'Error in countRentData repository', { error: err });
    throw new Error('DB: countRentData operation failed');
  });
};

export const updateRentData = async (
  rentDataId: string,
  data: RentDataUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.rentData.update({
    where: { rentDataId },
    data,
  }).catch(err => {
    logContext.function = 'updateRentData';
    logger.error(logContext, 'Error in updateRentData repository', { error: err });
    throw new Error('DB: rent data update operation failed');
  });
};

export const deleteRentData = async (
  rentDataId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.rentData.delete({
    where: { rentDataId },
  }).catch(err => {
    logContext.function = 'deleteRentData';
    logger.error(logContext, 'Error in deleteRentData repository', { error: err });
    throw new Error('DB: rent data delete operation failed');
  });
};
