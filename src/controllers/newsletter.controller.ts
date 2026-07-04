import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as newsletterService from '@/services/newsletter.service';
import type { SubscribeNewsletterDto, ConfirmNewsletterDto } from '@/dto/newsletter.dto';

export const subscribe = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await newsletterService.subscribeToNewsletter(req.body as SubscribeNewsletterDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Subscription request received. Please check your email to confirm.',
  };
  res.status(201).json(response);
};

export const confirm = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await newsletterService.confirmSubscription(req.body as ConfirmNewsletterDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Subscription confirmed successfully',
  };
  res.status(200).json(response);
};

export const unsubscribe = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { email } = req.params;
  await newsletterService.unsubscribeFromNewsletter(email);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Unsubscribed successfully',
  };
  res.status(200).json(response);
};

export const getAllSubscribers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const result = await newsletterService.getAllSubscribers(page, limit);

  const response: ApiResponse<typeof result> = {
    success: true,
    statusCode: 200,
    data: result,
    message: 'Subscribers fetched successfully',
  };
  res.status(200).json(response);
};
