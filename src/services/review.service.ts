import {
  createReview,
  findReviewById,
  findAllReviews,
  countReviews,
  updateReview,
  deleteReview,
  FindReviewsFilter,
} from '@/repositories/review.repository';
import { EntityNotFoundError, ForbiddenError, ValidationError } from '@/utils/custom-error';
import { findPostcodeById } from '@/repositories/postcode.repository';
import { findBoroughById } from '@/repositories/borough.repository';
import type { CreateReviewDto, UpdateReviewDto, UpdateReviewStatusDto } from '@/dto/review.dto';
import { paginate, buildPaginatedResult } from '@/utils/helpers';
import { ReviewStatus, UserRole } from '@/generated/prisma/enums';

export const getAllReviews = async (page: number, limit: number, filter?: FindReviewsFilter) => {
  const { offset } = paginate(page, limit);
  const [reviews, total] = await Promise.all([
    findAllReviews(limit, offset, filter),
    countReviews(filter),
  ]);
  return buildPaginatedResult(reviews, total, page, limit);
};

export const getReviewById = async (id: string) => {
  const review = await findReviewById(id);
  if (!review) {
    throw new EntityNotFoundError({
      message: `Review with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return review;
};

export const createNewReview = async (data: CreateReviewDto, authorId: string) => {
  if (data.postcodeId) {
    const postcode = await findPostcodeById(data.postcodeId);
    if (!postcode) {
      throw new ValidationError({
        message: `Postcode with ID ${data.postcodeId} does not exist`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  if (data.boroughId) {
    const borough = await findBoroughById(data.boroughId);
    if (!borough) {
      throw new ValidationError({
        message: `Borough with ID ${data.boroughId} does not exist`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  const overallRating =
    (data.safetyRating +
      data.transportRating +
      data.amenitiesRating +
      data.valueRating) /
    4;

  return await createReview({
    title: data.title,
    content: data.content,
    safetyRating: data.safetyRating,
    transportRating: data.transportRating,
    amenitiesRating: data.amenitiesRating,
    valueRating: data.valueRating,
    overallRating,
    pros: data.pros,
    cons: data.cons,
    yearsLived: data.yearsLived,
    anonymous: data.anonymous ?? false,
    verified: false,
    status: ReviewStatus.PENDING,
    author: { connect: { userId: authorId } },
    ...(data.postcodeId ? { postcode: { connect: { postcodeId: data.postcodeId } } } : {}),
    ...(data.boroughId ? { borough: { connect: { boroughId: data.boroughId } } } : {}),
  });
};

export const updateReviewById = async (
  id: string,
  data: UpdateReviewDto,
  userId: string,
  userRole: string,
) => {
  const existing = await getReviewById(id);

  // Authorization check: Only author or ADMIN can update
  if (existing.authorId !== userId && userRole !== UserRole.ADMIN) {
    throw new ForbiddenError({
      message: 'You are not authorized to update this review',
      code: 'VALIDATION_ERROR',
    });
  }

  if (data.postcodeId) {
    const postcode = await findPostcodeById(data.postcodeId);
    if (!postcode) {
      throw new ValidationError({
        message: `Postcode with ID ${data.postcodeId} does not exist`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  if (data.boroughId) {
    const borough = await findBoroughById(data.boroughId);
    if (!borough) {
      throw new ValidationError({
        message: `Borough with ID ${data.boroughId} does not exist`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  // Calculate new overall rating if any individual rating changes
  let overallRating: number | undefined;
  const safetyRating = data.safetyRating !== undefined ? data.safetyRating : existing.safetyRating;
  const transportRating = data.transportRating !== undefined ? data.transportRating : existing.transportRating;
  const amenitiesRating = data.amenitiesRating !== undefined ? data.amenitiesRating : existing.amenitiesRating;
  const valueRating = data.valueRating !== undefined ? data.valueRating : existing.valueRating;

  if (
    data.safetyRating !== undefined ||
    data.transportRating !== undefined ||
    data.amenitiesRating !== undefined ||
    data.valueRating !== undefined
  ) {
    overallRating = (safetyRating + transportRating + amenitiesRating + valueRating) / 4;
  }

  return await updateReview(id, {
    title: data.title,
    content: data.content,
    safetyRating: data.safetyRating,
    transportRating: data.transportRating,
    amenitiesRating: data.amenitiesRating,
    valueRating: data.valueRating,
    overallRating,
    pros: data.pros,
    cons: data.cons,
    yearsLived: data.yearsLived,
    anonymous: data.anonymous,
    ...(data.postcodeId ? { postcode: { connect: { postcodeId: data.postcodeId } } } : {}),
    ...(data.boroughId ? { borough: { connect: { boroughId: data.boroughId } } } : {}),
  });
};

export const updateReviewStatusById = async (id: string, data: UpdateReviewStatusDto) => {
  const updateData: any = {
    status: data.status,
    rejectionReason: data.status === ReviewStatus.REJECTED ? data.rejectionReason : null,
  };

  if (data.status === ReviewStatus.APPROVED) {
    updateData.publishedAt = new Date();
    updateData.verified = true; // Auto-verified when approved by admin
  }

  return await updateReview(id, updateData);
};

export const deleteReviewById = async (id: string, userId: string, userRole: string) => {
  const existing = await getReviewById(id);

  // Authorization check: Only author or ADMIN can delete
  if (existing.authorId !== userId && userRole !== UserRole.ADMIN) {
    throw new ForbiddenError({
      message: 'You are not authorized to delete this review',
      code: 'VALIDATION_ERROR',
    });
  }

  return await deleteReview(id);
};
