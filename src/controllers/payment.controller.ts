import type { Request, Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '@/types';
import * as paymentService from '@/services/payment.service';

export const createCheckout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await paymentService.createCheckout(req.params.reportId as string, req.user!.userId);
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data, message: 'Checkout session created' };
  res.status(200).json(response);
};

export const getOrderHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await paymentService.getOrderHistory(req.user!.userId);
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data, message: 'Order history fetched successfully' };
  res.status(200).json(response);
};

export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature'];
  const value = Array.isArray(signature) ? signature[0] : signature;
  const data = await paymentService.handleWebhook(req.body as Buffer, value ?? '');
  res.status(200).json(data);
};

export const webhookStatus = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    statusCode: 200,
    message: 'Stripe webhook endpoint is ready; send Stripe events with POST',
  });
};

export const createSubscriptionCheckout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await paymentService.createSubscriptionCheckout(req.user!.userId);
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data, message: 'Subscription checkout created' };
  res.status(200).json(response);
};

export const getBilling = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await paymentService.getBilling(req.user!.userId);
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data, message: 'Billing status fetched successfully' };
  res.status(200).json(response);
};