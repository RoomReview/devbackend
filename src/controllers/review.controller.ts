import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import {
  createReview as createReviewService,
  deleteReview as deleteReviewService,
  findApprovedReviewsByPostcode,
  findAllReviews,
  findReviewById,
  updateReview as updateReviewService,
  type CreateReviewInput,
} from '@/services/review.service';

export const getAllReviews = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    let data;
    if (req.query.postcodeId !== undefined) {
      if (typeof req.query.postcodeId !== 'string' || !req.query.postcodeId.trim()) {
        res.status(400).json({ success: false, statusCode: 400, error: 'A valid postcodeId is required' });
        return;
      }
      data = await findApprovedReviewsByPostcode(req.query.postcodeId.trim());
    } else {
      data = await findAllReviews();
    }
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
  const body = req.body as Record<string, unknown>;
  const isRating = (value: unknown): value is number => (
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
  );
  const isStringArray = (value: unknown): value is string[] => (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );

  if (
    typeof body.title !== 'string'
    || !body.title.trim()
    || typeof body.content !== 'string'
    || !body.content.trim()
    || !isRating(body.safety_rating)
    || !isRating(body.transport_rating)
    || !isRating(body.amenities_rating)
    || !isRating(body.value_rating)
    || typeof body.postcode_id !== 'string'
    || !body.postcode_id.trim()
    || (body.pros !== undefined && !isStringArray(body.pros))
    || (body.cons !== undefined && !isStringArray(body.cons))
    || (body.years_lived !== undefined && body.years_lived !== null
      && (!Number.isInteger(body.years_lived) || Number(body.years_lived) < 0 || Number(body.years_lived) > 100))
    || (body.anonymous !== undefined && typeof body.anonymous !== 'boolean')
    || (body.borough_id !== undefined && body.borough_id !== null && typeof body.borough_id !== 'string')
  ) {
    res.status(400).json({ success: false, statusCode: 400, error: 'Review details are invalid or incomplete' });
    return;
  }

  const reviewInput: CreateReviewInput = {
    title: body.title.trim(),
    content: body.content.trim(),
    safety_rating: body.safety_rating,
    transport_rating: body.transport_rating,
    amenities_rating: body.amenities_rating,
    value_rating: body.value_rating,
    pros: body.pros ?? [],
    cons: body.cons ?? [],
    years_lived: typeof body.years_lived === 'number' ? body.years_lived : null,
    anonymous: body.anonymous === true,
    postcode_id: body.postcode_id.trim(),
    borough_id: body.borough_id ?? null,
  };

  const authorId = req.user?.userId;
  if (!authorId) {
    res.status(401).json({ success: false, statusCode: 401, error: 'Authentication is required to submit a review' });
    return;
  }

  try {
    const data = await createReviewService(reviewInput, authorId);
    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 201,
      data,
      message: 'Review created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create review';
    res.status(500).json({ success: false, statusCode: 500, error: message });
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
