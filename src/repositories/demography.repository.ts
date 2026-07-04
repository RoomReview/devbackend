import { DemographySelect, DemographyCreateInput, DemographyUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'DemographyRepository',
  function: '',
};

export const createDemography = async (
  demo: DemographyCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.demography.create({ data: demo }).catch(err => {
    logContext.function = 'createDemography';
    logger.error(logContext, 'Error in createDemography repository', { error: err });
    throw new Error('DB: demography create operation failed');
  });
};

export const findDemographyById = async (demographyId: string, select?: DemographySelect) => {
  return await prisma.demography.findUnique({
    where: { demographyId },
    select: select || {
      demographyId: true,
      postcode: true,
      population: true,
      medianAge: true,
      socialGrade: true,
      recordedDate: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findDemographyById';
    logger.error(logContext, 'Error in findDemographyById repository', { error: err });
    throw new Error('DB: findDemographyById operation failed');
  });
};

export interface FindDemographyFilter {
  postcode?: string;
}

export const findAllDemography = async (
  limit: number,
  offset: number,
  filter?: FindDemographyFilter,
  select?: DemographySelect,
) => {
  const where: any = {};
  if (filter?.postcode) where.postcode = filter.postcode;

  return await prisma.demography.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { recordedDate: 'desc' },
    select: select || {
      demographyId: true,
      postcode: true,
      population: true,
      medianAge: true,
      socialGrade: true,
      recordedDate: true,
    },
  }).catch(err => {
    logContext.function = 'findAllDemography';
    logger.error(logContext, 'Error in findAllDemography repository', { error: err });
    throw new Error('DB: findAllDemography operation failed');
  });
};

export const countDemography = async (filter?: FindDemographyFilter) => {
  const where: any = {};
  if (filter?.postcode) where.postcode = filter.postcode;

  return await prisma.demography.count({ where }).catch(err => {
    logContext.function = 'countDemography';
    logger.error(logContext, 'Error in countDemography repository', { error: err });
    throw new Error('DB: countDemography operation failed');
  });
};

export const updateDemography = async (
  demographyId: string,
  data: DemographyUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.demography.update({
    where: { demographyId },
    data,
  }).catch(err => {
    logContext.function = 'updateDemography';
    logger.error(logContext, 'Error in updateDemography repository', { error: err });
    throw new Error('DB: demography update operation failed');
  });
};

export const deleteDemography = async (
  demographyId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.demography.delete({
    where: { demographyId },
  }).catch(err => {
    logContext.function = 'deleteDemography';
    logger.error(logContext, 'Error in deleteDemography repository', { error: err });
    throw new Error('DB: demography delete operation failed');
  });
};
