import { BoroughSelect, BoroughCreateInput, BoroughUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'BoroughRepository',
  function: '',
};

export const createBorough = async (
  borough: BoroughCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.borough.create({ data: borough }).catch(err => {
    logContext.function = 'createBorough';
    logger.error(logContext, 'Error in createBorough repository', { error: err });
    throw new Error('DB: borough create operation failed');
  });
};

export const findBoroughById = async (boroughId: string, select?: BoroughSelect) => {
  return await prisma.borough.findUnique({
    where: { boroughId },
    select: select || {
      boroughId: true,
      name: true,
      slug: true,
      description: true,
      image: true,
      latitude: true,
      longitude: true,
      metrics: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findBoroughById';
    logger.error(logContext, 'Error in findBoroughById repository', { error: err });
    throw new Error('DB: findBoroughById operation failed');
  });
};

export const findBoroughBySlug = async (slug: string, select?: BoroughSelect) => {
  return await prisma.borough.findUnique({
    where: { slug },
    select: select || {
      boroughId: true,
      name: true,
      slug: true,
      description: true,
      image: true,
      latitude: true,
      longitude: true,
      metrics: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findBoroughBySlug';
    logger.error(logContext, 'Error in findBoroughBySlug repository', { error: err });
    throw new Error('DB: findBoroughBySlug operation failed');
  });
};

export const findAllBoroughs = async (
  limit?: number,
  offset?: number,
  select?: BoroughSelect,
) => {
  return await prisma.borough.findMany({
    take: limit,
    skip: offset,
    orderBy: { name: 'asc' },
    select: select || {
      boroughId: true,
      name: true,
      slug: true,
      description: true,
      image: true,
      metrics: true,
    },
  }).catch(err => {
    logContext.function = 'findAllBoroughs';
    logger.error(logContext, 'Error in findAllBoroughs repository', { error: err });
    throw new Error('DB: findAllBoroughs operation failed');
  });
};

export const countBoroughs = async () => {
  return await prisma.borough.count().catch(err => {
    logContext.function = 'countBoroughs';
    logger.error(logContext, 'Error in countBoroughs repository', { error: err });
    throw new Error('DB: countBoroughs operation failed');
  });
};

export const updateBorough = async (
  boroughId: string,
  data: BoroughUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.borough.update({
    where: { boroughId },
    data,
  }).catch(err => {
    logContext.function = 'updateBorough';
    logger.error(logContext, 'Error in updateBorough repository', { error: err });
    throw new Error('DB: borough update operation failed');
  });
};

export const deleteBorough = async (
  boroughId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.borough.delete({
    where: { boroughId },
  }).catch(err => {
    logContext.function = 'deleteBorough';
    logger.error(logContext, 'Error in deleteBorough repository', { error: err });
    throw new Error('DB: borough delete operation failed');
  });
};
