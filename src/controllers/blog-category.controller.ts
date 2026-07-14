import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as blogCategoryService from '@/services/blog-category.service';
import type { CreateBlogCategoryDto, UpdateBlogCategoryDto } from '@/dto/blog-category.dto';

export const getAllBlogCategories = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const { data, pagination } = await blogCategoryService.getAllBlogCategories();

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'Blog categories fetched successfully',
  };
  res.status(200).json(response);
};

export const getBlogCategoryById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await blogCategoryService.getBlogCategoryById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Blog category fetched successfully',
  };
  res.status(200).json(response);
};

export const getBlogCategoryBySlug = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { slug } = req.params;
  const data = await blogCategoryService.getBlogCategoryBySlug(slug);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Blog category fetched successfully by slug',
  };
  res.status(200).json(response);
};

export const createBlogCategory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await blogCategoryService.createNewBlogCategory(req.body as CreateBlogCategoryDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Blog category created successfully',
  };
  res.status(201).json(response);
};

export const updateBlogCategory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await blogCategoryService.updateBlogCategoryById(id, req.body as UpdateBlogCategoryDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Blog category updated successfully',
  };
  res.status(200).json(response);
};

export const deleteBlogCategory = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  await blogCategoryService.deleteBlogCategoryById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Blog category deleted successfully',
  };
  res.status(200).json(response);
};
