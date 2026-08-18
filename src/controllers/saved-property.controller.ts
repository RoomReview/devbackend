import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const getSavedProperties = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    data: null,
    message: 'Saved properties fetched successfully',
  };
  res.status(200).json(response);
};

export const saveProperty = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = {
    success: true,
    statusCode: 201,
    data: null,
    message: 'Property saved successfully',
  };
  res.status(201).json(response);
};

export const removeSavedProperty = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    data: null,
    message: 'Property removed from saved list successfully',
  };
  res.status(200).json(response);
};
