import { PostcodeSelect, PostcodeCreateInput, PostcodeUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'PostcodeRepository',
  function: '',
};

export const createPostcode = async (
  postcode: PostcodeCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.postcode.create({ data: postcode }).catch(err => {
    logContext.function = 'createPostcode';
    logger.error(logContext, 'Error in createPostcode repository', { error: err });
    throw new Error('DB: postcode create operation failed');
  });
};

export const findPostcodeById = async (postcodeId: string, select?: PostcodeSelect) => {
  return await prisma.postcode.findUnique({
    where: { postcodeId },
    select: select || {
      postcodeId: true,
      code: true,
      outcode: true,
      incode: true,
      latitude: true,
      longitude: true,
      metrics: true,
      boroughId: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findPostcodeById';
    logger.error(logContext, 'Error in findPostcodeById repository', { error: err });
    throw new Error('DB: findPostcodeById operation failed');
  });
};

export const findPostcodeByCode = async (code: string, select?: PostcodeSelect) => {
  return await prisma.postcode.findUnique({
    where: { code },
    select: select || {
      postcodeId: true,
      code: true,
      outcode: true,
      incode: true,
      latitude: true,
      longitude: true,
      metrics: true,
      boroughId: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findPostcodeByCode';
    logger.error(logContext, 'Error in findPostcodeByCode repository', { error: err });
    throw new Error('DB: findPostcodeByCode operation failed');
  });
};

export interface FindPostcodesFilter {
  outcode?: string;
  boroughId?: string;
}

export const findAllPostcodes = async (
  limit: number,
  offset: number,
  filter?: FindPostcodesFilter,
  select?: PostcodeSelect,
) => {
  const where: any = {};
  if (filter?.outcode) where.outcode = filter.outcode;
  if (filter?.boroughId) where.boroughId = filter.boroughId;

  return await prisma.postcode.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { code: 'asc' },
    select: select || {
      postcodeId: true,
      code: true,
      outcode: true,
      incode: true,
      latitude: true,
      longitude: true,
      boroughId: true,
    },
  }).catch(err => {
    logContext.function = 'findAllPostcodes';
    logger.error(logContext, 'Error in findAllPostcodes repository', { error: err });
    throw new Error('DB: findAllPostcodes operation failed');
  });
};

export const countPostcodes = async (filter?: FindPostcodesFilter) => {
  const where: any = {};
  if (filter?.outcode) where.outcode = filter.outcode;
  if (filter?.boroughId) where.boroughId = filter.boroughId;

  return await prisma.postcode.count({ where }).catch(err => {
    logContext.function = 'countPostcodes';
    logger.error(logContext, 'Error in countPostcodes repository', { error: err });
    throw new Error('DB: countPostcodes operation failed');
  });
};

export const updatePostcode = async (
  postcodeId: string,
  data: PostcodeUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.postcode.update({
    where: { postcodeId },
    data,
  }).catch(err => {
    logContext.function = 'updatePostcode';
    logger.error(logContext, 'Error in updatePostcode repository', { error: err });
    throw new Error('DB: postcode update operation failed');
  });
};

export const deletePostcode = async (
  postcodeId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.postcode.delete({
    where: { postcodeId },
  }).catch(err => {
    logContext.function = 'deletePostcode';
    logger.error(logContext, 'Error in deletePostcode repository', { error: err });
    throw new Error('DB: postcode delete operation failed');
  });
};
