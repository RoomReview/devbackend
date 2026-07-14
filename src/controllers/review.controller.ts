import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '@/types';
import * as reviewService from '@/services/review.service';
import type { CreateReviewDto, UpdateReviewDto, UpdateReviewStatusDto } from '@/dto/review.dto';
import { ReviewStatus } from '@/generated/prisma/enums';

export const getAllReviews = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  
  const filter = {
    postcodeId: req.query.postcodeId as string,
    boroughId: req.query.boroughId as string,
    authorId: req.query.authorId as string,
    status: req.query.status as ReviewStatus,
  };

  const { data, pagination } = await reviewService.getAllReviews(page, limit, filter);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'Reviews fetched successfully',
  };
  res.status(200).json(response);
};

export const getReviewById = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  const data = await reviewService.getReviewById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Review fetched successfully',
  };
  res.status(200).json(response);
};

export const createReview = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const authorId = req.user!.userId;
  const data = await reviewService.createNewReview(req.body as CreateReviewDto, authorId);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Review created successfully',
  };
  res.status(201).json(response);
};

export const updateReview = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const data = await reviewService.updateReviewById(id, req.body as UpdateReviewDto, userId, role);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Review updated successfully',
  };
  res.status(200).json(response);
};

export const updateReviewStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  const data = await reviewService.updateReviewStatusById(id, req.body as UpdateReviewStatusDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Review status updated successfully',
  };
  res.status(200).json(response);
};

export const deleteReview = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  const userId = req.user!.userId;
  const role = req.user!.role;
  await reviewService.deleteReviewById(id, userId, role);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Review deleted successfully',
  };
  res.status(200).json(response);
};
