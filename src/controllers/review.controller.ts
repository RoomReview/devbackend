import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import {
  createReview as createReviewService,
  deleteReview as deleteReviewService,
  findAllReviews,
  findReviewById,
  updateReview as updateReviewService,
} from '@/services/review.service';

export const getAllReviews = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await findAllReviews();
    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 200,
      data,
      message: 'Reviews fetched successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ success: false, statusCode: 500, error: message });
  }
};

export const getReviewById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = String(req.params.id ?? '');
    const data = await findReviewById(id);
    if (!data) {
      res.status(404).json({ success: false, statusCode: 404, error: 'Review not found' });
      return;
    }

    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 200,
      data,
      message: 'Review fetched successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ success: false, statusCode: 500, error: message });
  }
};

export const createReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await createReviewService(req.body);
    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 201,
      data,
      message: 'Review created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create review';
    res.status(400).json({ success: false, statusCode: 400, error: message });
  }
};

export const updateReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = String(req.params.id ?? '');
    const data = await updateReviewService(id, req.body);
    if (!data) {
      res.status(404).json({ success: false, statusCode: 404, error: 'Review not found' });
      return;
    }

    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 200,
      data,
      message: 'Review updated successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update review';
    res.status(400).json({ success: false, statusCode: 400, error: message });
  }
};

export const deleteReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = String(req.params.id ?? '');
    const deleted = await deleteReviewService(id);
    const response: ApiResponse<null> = {
      success: deleted,
      statusCode: deleted ? 200 : 404,
      data: null,
      message: deleted ? 'Review deleted successfully' : 'Review not found',
    };
    res.status(response.statusCode).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete review';
    res.status(400).json({ success: false, statusCode: 400, error: message });
  }
};
