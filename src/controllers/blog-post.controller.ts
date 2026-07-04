import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as blogPostService from '@/services/blog-post.service';
import type { CreateBlogPostDto, UpdateBlogPostDto } from '@/dto/blog-post.dto';
import { BlogStatus } from '@/generated/prisma/enums';

export const getAllBlogPosts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const filter = {
    categoryId: req.query.categoryId as string,
    tagId: req.query.tagId as string,
    status: req.query.status as BlogStatus,
  };

  const { data, pagination } = await blogPostService.getAllBlogPosts(page, limit, filter);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'Blog posts fetched successfully',
  };
  res.status(200).json(response);
};

export const getBlogPostById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await blogPostService.getBlogPostById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Blog post fetched successfully',
  };
  res.status(200).json(response);
};

export const getBlogPostBySlug = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { slug } = req.params;
  const data = await blogPostService.getBlogPostBySlug(slug);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Blog post fetched successfully by slug',
  };
  res.status(200).json(response);
};

export const createBlogPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await blogPostService.createNewBlogPost(req.body as CreateBlogPostDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Blog post created successfully',
  };
  res.status(201).json(response);
};

export const updateBlogPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await blogPostService.updateBlogPostById(id, req.body as UpdateBlogPostDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Blog post updated successfully',
  };
  res.status(200).json(response);
};

export const deleteBlogPost = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  await blogPostService.deleteBlogPostById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Blog post deleted successfully',
  };
  res.status(200).json(response);
};
