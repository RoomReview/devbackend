import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const getAllPropertyValueData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Property value data fetched successfully' };
  res.status(200).json(response);
};

export const getPropertyValueDataById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Property value data fetched successfully' };
  res.status(200).json(response);
};

export const createPropertyValueData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Property value data created successfully' };
  res.status(201).json(response);
};

export const bulkCreatePropertyValueData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Property value data bulk created successfully' };
  res.status(201).json(response);
};

export const updatePropertyValueData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Property value data updated successfully' };
  res.status(200).json(response);
};

export const deletePropertyValueData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Property value data deleted successfully' };
  res.status(200).json(response);
};
