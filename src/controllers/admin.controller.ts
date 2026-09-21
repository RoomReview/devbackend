import type { Response } from 'express';
import type { ApiResponse, AuthenticatedRequest } from '@/types';
import { getAdminOverview, getAdminUsers, setUserActive } from '@/repositories/admin.repository';
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
