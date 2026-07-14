import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as blogTagService from '@/services/blog-tag.service';
import type { CreateBlogTagDto, UpdateBlogTagDto } from '@/dto/blog-tag.dto';

export const getAllBlogTags = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const { data } = await blogTagService.getAllBlogTags();

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Blog tags fetched successfully',
  };
  res.status(200).json(response);
};

export const getBlogTagById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  const data = await blogTagService.getBlogTagById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Blog tag fetched successfully',
  };
  res.status(200).json(response);
};

export const getBlogTagBySlug = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { slug } = req.params as any;
  const data = await blogTagService.getBlogTagBySlug(slug);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Blog tag fetched successfully by slug',
  };
  res.status(200).json(response);
};

export const createBlogTag = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await blogTagService.createNewBlogTag(req.body as CreateBlogTagDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Blog tag created successfully',
  };
  res.status(201).json(response);
};

export const updateBlogTag = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  const data = await blogTagService.updateBlogTagById(id, req.body as UpdateBlogTagDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Blog tag updated successfully',
  };
  res.status(200).json(response);
};

export const deleteBlogTag = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  await blogTagService.deleteBlogTagById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Blog tag deleted successfully',
  };
  res.status(200).json(response);
};
