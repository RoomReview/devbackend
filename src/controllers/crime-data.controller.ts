import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const getAllCrimeData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Crime data fetched successfully' };
  res.status(200).json(response);
};

export const getCrimeDataById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Crime data fetched successfully' };
  res.status(200).json(response);
};

export const createCrimeData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Crime data created successfully' };
  res.status(201).json(response);
};

export const bulkCreateCrimeData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Crime data bulk created successfully' };
  res.status(201).json(response);
};

export const updateCrimeData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Crime data updated successfully' };
  res.status(200).json(response);
};

export const deleteCrimeData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Crime data deleted successfully' };
  res.status(200).json(response);
};
