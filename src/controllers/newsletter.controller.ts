import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const subscribe = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Subscribed successfully' };
  res.status(201).json(response);
};

export const confirmSubscription = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Subscription confirmed successfully' };
  res.status(200).json(response);
};

export const unsubscribe = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Unsubscribed successfully' };
  res.status(200).json(response);
};
