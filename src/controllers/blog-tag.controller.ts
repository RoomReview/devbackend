import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const getAllBlogTags = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog tags fetched successfully' };
  res.status(200).json(response);
};

export const getBlogTagById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog tag fetched successfully' };
  res.status(200).json(response);
};

export const createBlogTag = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Blog tag created successfully' };
  res.status(201).json(response);
};

export const updateBlogTag = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog tag updated successfully' };
  res.status(200).json(response);
};

export const deleteBlogTag = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog tag deleted successfully' };
  res.status(200).json(response);
};
