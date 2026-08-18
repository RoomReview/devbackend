import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';
import { getPostcodeLookupCandidates } from '@/utils/postcode';
import type { PostcodeRecord } from '@/types/postcode';

type PostcodeSelect = Record<string, boolean | undefined>;
type PostcodeCreateInput = Record<string, unknown>;
type PostcodeUpdateInput = Record<string, unknown>;

const getPostcodeClient = (client: typeof prisma | Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$use' | '$extends'> = prisma) => {
  const postcodeClient = (client as typeof prisma & { postcode?: unknown }).postcode;

  if (!postcodeClient) {
    throw new Error('Postcode model is not available in the current Prisma schema');
  }

  return postcodeClient as unknown as {
    create: (args: { data: PostcodeCreateInput }) => Promise<PostcodeRecord>;
    findUnique: (args: Record<string, unknown>) => Promise<PostcodeRecord | null>;
    findMany: (args: Record<string, unknown>) => Promise<PostcodeRecord[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
    update: (args: { where: Record<string, unknown>; data: PostcodeUpdateInput }) => Promise<PostcodeRecord>;
    delete: (args: { where: Record<string, unknown> }) => Promise<PostcodeRecord>;
  };
};

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
  return await getPostcodeClient(tx).create({ data: postcode }).catch((err: unknown) => {
    logContext.function = 'createPostcode';
    logger.error(logContext, 'Error in createPostcode repository', { error: err });
    throw new Error('DB: postcode create operation failed');
  });
};

export const findPostcodeById = async (postcodeId: string, select?: PostcodeSelect): Promise<PostcodeRecord | null> => {
  return await getPostcodeClient().findUnique({
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
  }).catch((err: unknown) => {
    logContext.function = 'findPostcodeById';
    logger.error(logContext, 'Error in findPostcodeById repository', { error: err });
    throw new Error('DB: findPostcodeById operation failed');
  });
};

export const findPostcodeByCode = async (code: string, select?: PostcodeSelect): Promise<PostcodeRecord | null> => {
  const candidates = getPostcodeLookupCandidates(code);

  const postcode = await getPostcodeClient().findUnique({
    where: { code: candidates[0] },
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
  }).catch((err: unknown) => {
    logContext.function = 'findPostcodeByCode';
    logger.error(logContext, 'Error in findPostcodeByCode repository', { error: err });
    throw new Error('DB: findPostcodeByCode operation failed');
  });

  if (postcode) {
    return postcode;
  }

  for (const candidate of candidates.slice(1)) {
    const fallback = await getPostcodeClient().findUnique({
      where: { code: candidate },
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
    }).catch((err: unknown) => {
      logContext.function = 'findPostcodeByCode';
      logger.error(logContext, 'Error in findPostcodeByCode repository', { error: err });
      throw new Error('DB: findPostcodeByCode operation failed');
    });

    if (fallback) {
      return fallback;
    }
  }

  return null;
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
): Promise<PostcodeRecord[]> => {
  const where: Record<string, unknown> = {};
  if (filter?.outcode) where.outcode = filter.outcode;
  if (filter?.boroughId) where.boroughId = filter.boroughId;

  return await getPostcodeClient().findMany({
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
  }).catch((err: unknown) => {
    logContext.function = 'findAllPostcodes';
    logger.error(logContext, 'Error in findAllPostcodes repository', { error: err });
    throw new Error('DB: findAllPostcodes operation failed');
  });
};

export const countPostcodes = async (filter?: FindPostcodesFilter) => {
  const where: Record<string, unknown> = {};
  if (filter?.outcode) where.outcode = filter.outcode;
  if (filter?.boroughId) where.boroughId = filter.boroughId;

  return await getPostcodeClient().count({ where }).catch((err: unknown) => {
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
  return await getPostcodeClient(tx).update({
    where: { postcodeId },
    data,
  }).catch((err: unknown) => {
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
  return await getPostcodeClient(tx).delete({
    where: { postcodeId },
  }).catch((err: unknown) => {
    logContext.function = 'deletePostcode';
    logger.error(logContext, 'Error in deletePostcode repository', { error: err });
    throw new Error('DB: postcode delete operation failed');
  });
};
