import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const getAllBlogPosts = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog posts fetched successfully' };
  res.status(200).json(response);
};

export const getBlogPostById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog post fetched successfully' };
  res.status(200).json(response);
};

export const createBlogPost = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Blog post created successfully' };
  res.status(201).json(response);
};

export const updateBlogPost = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog post updated successfully' };
  res.status(200).json(response);
};

export const deleteBlogPost = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Blog post deleted successfully' };
  res.status(200).json(response);
};
