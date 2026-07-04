import { ReviewSelect, ReviewCreateInput, ReviewUpdateInput } from '@/generated/prisma/models';
import { ReviewStatus } from '@/generated/prisma/enums';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'ReviewRepository',
  function: '',
};

export const createReview = async (
  review: ReviewCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.review.create({ data: review }).catch(err => {
    logContext.function = 'createReview';
    logger.error(logContext, 'Error in createReview repository', { error: err });
    throw new Error('DB: review create operation failed');
  });
};

export const findReviewById = async (reviewId: string, select?: ReviewSelect) => {
  return await prisma.review.findUnique({
    where: { reviewId },
    select: select || {
      reviewId: true,
      title: true,
      content: true,
      safetyRating: true,
      transportRating: true,
      amenitiesRating: true,
      valueRating: true,
      overallRating: true,
      pros: true,
      cons: true,
      yearsLived: true,
      anonymous: true,
      verified: true,
      status: true,
      rejectionReason: true,
      authorId: true,
      postcodeId: true,
      boroughId: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findReviewById';
    logger.error(logContext, 'Error in findReviewById repository', { error: err });
    throw new Error('DB: findReviewById operation failed');
  });
};

export interface FindReviewsFilter {
  postcodeId?: string;
  boroughId?: string;
  authorId?: string;
  status?: ReviewStatus;
}

export const findAllReviews = async (
  limit: number,
  offset: number,
  filter?: FindReviewsFilter,
  select?: ReviewSelect,
) => {
  const where: any = {};
  if (filter?.postcodeId) where.postcodeId = filter.postcodeId;
  if (filter?.boroughId) where.boroughId = filter.boroughId;
  if (filter?.authorId) where.authorId = filter.authorId;
  if (filter?.status) where.status = filter.status;

  return await prisma.review.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: select || {
      reviewId: true,
      title: true,
      content: true,
      overallRating: true,
      anonymous: true,
      verified: true,
      status: true,
      authorId: true,
      postcodeId: true,
      boroughId: true,
      createdAt: true,
    },
  }).catch(err => {
    logContext.function = 'findAllReviews';
    logger.error(logContext, 'Error in findAllReviews repository', { error: err });
    throw new Error('DB: findAllReviews operation failed');
  });
};

export const countReviews = async (filter?: FindReviewsFilter) => {
  const where: any = {};
  if (filter?.postcodeId) where.postcodeId = filter.postcodeId;
  if (filter?.boroughId) where.boroughId = filter.boroughId;
  if (filter?.authorId) where.authorId = filter.authorId;
  if (filter?.status) where.status = filter.status;

  return await prisma.review.count({ where }).catch(err => {
    logContext.function = 'countReviews';
    logger.error(logContext, 'Error in countReviews repository', { error: err });
    throw new Error('DB: countReviews operation failed');
  });
};

export const updateReview = async (
  reviewId: string,
  data: ReviewUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.review.update({
    where: { reviewId },
    data,
  }).catch(err => {
    logContext.function = 'updateReview';
    logger.error(logContext, 'Error in updateReview repository', { error: err });
    throw new Error('DB: review update operation failed');
  });
};

export const deleteReview = async (
  reviewId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.review.delete({
    where: { reviewId },
  }).catch(err => {
    logContext.function = 'deleteReview';
    logger.error(logContext, 'Error in deleteReview repository', { error: err });
    throw new Error('DB: review delete operation failed');
  });
};
