import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const getAllExperiences = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Experiences fetched successfully' };
  res.status(200).json(response);
};

export const getExperienceById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Experience fetched successfully' };
  res.status(200).json(response);
};

export const createExperience = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Experience created successfully' };
  res.status(201).json(response);
};

export const updateExperience = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Experience updated successfully' };
  res.status(200).json(response);
};

export const deleteExperience = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Experience deleted successfully' };
  res.status(200).json(response);
};
