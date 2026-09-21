import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const getAllDemography = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Demography fetched successfully' };
  res.status(200).json(response);
};

export const getDemographyById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Demography fetched successfully' };
  res.status(200).json(response);
};

export const createDemography = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Demography created successfully' };
  res.status(201).json(response);
};

export const bulkCreateDemography = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Demography bulk created successfully' };
  res.status(201).json(response);
};

export const updateDemography = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Demography updated successfully' };
  res.status(200).json(response);
};

export const deleteDemography = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Demography deleted successfully' };
  res.status(200).json(response);
};
