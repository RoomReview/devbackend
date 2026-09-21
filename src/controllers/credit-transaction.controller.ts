import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const createTransaction = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Credit transaction created successfully' };
  res.status(201).json(response);
};

export const getTransactionById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Credit transaction fetched successfully' };
  res.status(200).json(response);
};

export const getUserTransactions = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'User credit transactions fetched successfully' };
  res.status(200).json(response);
};

export const getAllCreditTransactions = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'All credit transactions fetched successfully' };
  res.status(200).json(response);
};

export const getCreditTransactionById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Credit transaction fetched successfully' };
  res.status(200).json(response);
};
