import { CrimeDataSelect, CrimeDataCreateInput, CrimeDataUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'CrimeDataRepository',
  function: '',
};

export const createCrimeData = async (
  crime: CrimeDataCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.crimeData.create({ data: crime }).catch(err => {
    logContext.function = 'createCrimeData';
    logger.error(logContext, 'Error in createCrimeData repository', { error: err });
    throw new Error('DB: crime data create operation failed');
  });
};

export const createManyCrimeData = async (
  data: CrimeDataCreateInput[],
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.crimeData.createMany({ data }).catch(err => {
    logContext.function = 'createManyCrimeData';
    logger.error(logContext, 'Error in createManyCrimeData repository', { error: err });
    throw new Error('DB: crime data bulk create operation failed');
  });
};

export const findCrimeDataById = async (crimeDataId: string, select?: CrimeDataSelect) => {
  return await prisma.crimeData.findUnique({
    where: { crimeDataId },
    select: select || {
      crimeDataId: true,
      borough: true,
      crimeType: true,
      crimeCount: true,
      recordedDate: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findCrimeDataById';
    logger.error(logContext, 'Error in findCrimeDataById repository', { error: err });
    throw new Error('DB: findCrimeDataById operation failed');
  });
};

export interface FindCrimeDataFilter {
  borough?: string;
  crimeType?: string;
}

export const findAllCrimeData = async (
  limit: number,
  offset: number,
  filter?: FindCrimeDataFilter,
  select?: CrimeDataSelect,
) => {
  const where: any = {};
  if (filter?.borough) where.borough = filter.borough;
  if (filter?.crimeType) where.crimeType = filter.crimeType;

  return await prisma.crimeData.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { recordedDate: 'desc' },
    select: select || {
      crimeDataId: true,
      borough: true,
      crimeType: true,
      crimeCount: true,
      recordedDate: true,
    },
  }).catch(err => {
    logContext.function = 'findAllCrimeData';
    logger.error(logContext, 'Error in findAllCrimeData repository', { error: err });
    throw new Error('DB: findAllCrimeData operation failed');
  });
};

export const countCrimeData = async (filter?: FindCrimeDataFilter) => {
  const where: any = {};
  if (filter?.borough) where.borough = filter.borough;
  if (filter?.crimeType) where.crimeType = filter.crimeType;

  return await prisma.crimeData.count({ where }).catch(err => {
    logContext.function = 'countCrimeData';
    logger.error(logContext, 'Error in countCrimeData repository', { error: err });
    throw new Error('DB: countCrimeData operation failed');
  });
};

export const updateCrimeData = async (
  crimeDataId: string,
  data: CrimeDataUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.crimeData.update({
    where: { crimeDataId },
    data,
  }).catch(err => {
    logContext.function = 'updateCrimeData';
    logger.error(logContext, 'Error in updateCrimeData repository', { error: err });
    throw new Error('DB: crime data update operation failed');
  });
};

export const deleteCrimeData = async (
  crimeDataId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.crimeData.delete({
    where: { crimeDataId },
  }).catch(err => {
    logContext.function = 'deleteCrimeData';
    logger.error(logContext, 'Error in deleteCrimeData repository', { error: err });
    throw new Error('DB: crime data delete operation failed');
  });
};
