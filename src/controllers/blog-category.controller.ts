import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const getAllBlogCategories = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog categories fetched successfully' };
  res.status(200).json(response);
};

export const getBlogCategoryById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog category fetched successfully' };
  res.status(200).json(response);
};

export const createBlogCategory = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Blog category created successfully' };
  res.status(201).json(response);
};

export const updateBlogCategory = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog category updated successfully' };
  res.status(200).json(response);
};

export const deleteBlogCategory = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog category deleted successfully' };
  res.status(200).json(response);
};
