import type { Response } from 'express';
import type { ApiResponse, AuthenticatedRequest } from '@/types';
import { getAdminOverview, getAdminUsers, setUserActive } from '@/repositories/admin.repository';
import { ModerateReviewDto } from '@/dto/review.dto';
import {
  deleteReview as deleteReviewService,
  findReviewsForAdmin,
  moderateReview as moderateReviewService,
} from '@/services/review.service';
import { getReviewNotificationRecipient } from '@/repositories/users.repository';
import { sendReviewModerationEmail } from '@/utils/email';
import logger from '@/utils/logger';
import { cancelSubscriptionAtPeriodEnd } from '@/services/payment.service';

export const getOverview = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await getAdminOverview();
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Administrative overview fetched successfully',
  };
  res.status(200).json(response);
};

export const getUsers = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await getAdminUsers();
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Administrative users fetched successfully',
  };
  res.status(200).json(response);
};

export const getReviews = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await findReviewsForAdmin();
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Reviews fetched successfully',
  };
  res.status(200).json(response);
};

export const deleteReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const reviewId = String(req.params.reviewId ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reviewId)) {
    res.status(400).json({ success: false, statusCode: 400, error: 'A valid review ID is required' });
    return;
  }

  const deleted = await deleteReviewService(reviewId);
  if (!deleted) {
    res.status(404).json({ success: false, statusCode: 404, error: 'Review not found' });
    return;
  }

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    data: null,
    message: 'Review deleted successfully',
  };
  res.status(200).json(response);
};

export const moderateReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const reviewId = String(req.params.reviewId ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reviewId)) {
    res.status(400).json({ success: false, statusCode: 400, error: 'A valid review ID is required' });
    return;
  }

  const input = ModerateReviewDto.parse(req.body);
  const data = await moderateReviewService(reviewId, input.status, input.rejection_reason);
  if (!data) {
    res.status(404).json({ success: false, statusCode: 404, error: 'Pending review not found' });
    return;
  }

  const recipient = await getReviewNotificationRecipient(data.author_id);
  const shouldNotify = input.status === 'APPROVED'
    ? recipient?.emailOnReviewApproved
    : recipient?.emailOnReviewRejected;
  let notificationWarning: string | undefined;
  if (recipient && shouldNotify) {
    try {
      await sendReviewModerationEmail(
        recipient.email,
        recipient.firstName,
        data.title,
        input.status,
        input.rejection_reason,
      );
    } catch (error) {
      notificationWarning = 'The review was updated, but its email notification could not be sent.';
      logger.error(
        { service: 'ReviewModeration', function: 'sendReviewModerationEmail' },
        notificationWarning,
        { reviewId, status: input.status, error },
      );
    }
  }

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: notificationWarning
      ?? (input.status === 'APPROVED' ? 'Review approved and published' : 'Review rejected'),
  };
  res.status(200).json(response);
};

export const cancelUserSubscription = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await cancelSubscriptionAtPeriodEnd(String(req.params.userId));
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Subscription cancellation scheduled successfully',
  };
  res.status(200).json(response);
};

export const toggleUserBan = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const isActive = req.body.isActive === true;
  const data = await setUserActive(String(req.params.userId), isActive);
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: isActive ? 'User unbanned successfully' : 'User banned successfully',
  };
  res.status(200).json(response);
};
