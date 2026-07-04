import { VotingDataSelect, VotingDataCreateInput, VotingDataUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'VotingDataRepository',
  function: '',
};

export const createVotingData = async (
  voting: VotingDataCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.votingData.create({ data: voting }).catch(err => {
    logContext.function = 'createVotingData';
    logger.error(logContext, 'Error in createVotingData repository', { error: err });
    throw new Error('DB: voting data create operation failed');
  });
};

export const createManyVotingData = async (
  data: VotingDataCreateInput[],
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.votingData.createMany({ data }).catch(err => {
    logContext.function = 'createManyVotingData';
    logger.error(logContext, 'Error in createManyVotingData repository', { error: err });
    throw new Error('DB: voting data bulk create operation failed');
  });
};

export const findVotingDataById = async (votingDataId: string, select?: VotingDataSelect) => {
  return await prisma.votingData.findUnique({
    where: { votingDataId },
    select: select || {
      votingDataId: true,
      borough: true,
      wardName: true,
      year: true,
      party: true,
      votes: true,
      percentage: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findVotingDataById';
    logger.error(logContext, 'Error in findVotingDataById repository', { error: err });
    throw new Error('DB: findVotingDataById operation failed');
  });
};

export interface FindVotingDataFilter {
  borough?: string;
  year?: number;
  party?: string;
}

export const findAllVotingData = async (
  limit: number,
  offset: number,
  filter?: FindVotingDataFilter,
  select?: VotingDataSelect,
) => {
  const where: any = {};
  if (filter?.borough) where.borough = filter.borough;
  if (filter?.year !== undefined) where.year = filter.year;
  if (filter?.party) where.party = filter.party;

  return await prisma.votingData.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { year: 'desc' },
    select: select || {
      votingDataId: true,
      borough: true,
      wardName: true,
      year: true,
      party: true,
      votes: true,
      percentage: true,
    },
  }).catch(err => {
    logContext.function = 'findAllVotingData';
    logger.error(logContext, 'Error in findAllVotingData repository', { error: err });
    throw new Error('DB: findAllVotingData operation failed');
  });
};

export const countVotingData = async (filter?: FindVotingDataFilter) => {
  const where: any = {};
  if (filter?.borough) where.borough = filter.borough;
  if (filter?.year !== undefined) where.year = filter.year;
  if (filter?.party) where.party = filter.party;

  return await prisma.votingData.count({ where }).catch(err => {
    logContext.function = 'countVotingData';
    logger.error(logContext, 'Error in countVotingData repository', { error: err });
    throw new Error('DB: countVotingData operation failed');
  });
};

export const updateVotingData = async (
  votingDataId: string,
  data: VotingDataUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.votingData.update({
    where: { votingDataId },
    data,
  }).catch(err => {
    logContext.function = 'updateVotingData';
    logger.error(logContext, 'Error in updateVotingData repository', { error: err });
    throw new Error('DB: voting data update operation failed');
  });
};

export const deleteVotingData = async (
  votingDataId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.votingData.delete({
    where: { votingDataId },
  }).catch(err => {
    logContext.function = 'deleteVotingData';
    logger.error(logContext, 'Error in deleteVotingData repository', { error: err });
    throw new Error('DB: voting data delete operation failed');
  });
};
