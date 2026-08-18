import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const getAllRentData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Rent data fetched successfully' };
  res.status(200).json(response);
};

export const getRentDataById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Rent data fetched successfully' };
  res.status(200).json(response);
};

export const createRentData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Rent data created successfully' };
  res.status(201).json(response);
};

export const bulkCreateRentData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Rent data bulk created successfully' };
  res.status(201).json(response);
};

export const updateRentData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Rent data updated successfully' };
  res.status(200).json(response);
};

export const deleteRentData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Rent data deleted successfully' };
  res.status(200).json(response);
};
