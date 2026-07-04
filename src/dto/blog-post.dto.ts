import { BlogStatus } from '@/generated/prisma/enums';
import {
  object,
  string,
  number,
  array,
  enum as enum_,
  type infer as _infer,
} from 'zod';

export const CreateBlogPostDto = object({
  title: string().min(1),
  slug: string().min(1),
  excerpt: string().min(1),
  content: string().min(1),
  featuredImage: string().optional(),
  readTime: number().int().positive().optional(),
  status: enum_([
    BlogStatus.DRAFT,
    BlogStatus.PUBLISHED,
    BlogStatus.ARCHIVED,
  ]).optional(),
  categoryId: string().uuid().optional(),
  tagIds: array(string().uuid()).optional(),
  metaTitle: string().optional(),
  metaDescription: string().optional(),
});

export type CreateBlogPostDto = _infer<typeof CreateBlogPostDto>;

export const UpdateBlogPostDto = object({
  title: string().min(1).optional(),
  slug: string().min(1).optional(),
  excerpt: string().min(1).optional(),
  content: string().min(1).optional(),
  featuredImage: string().optional(),
  readTime: number().int().positive().optional(),
  status: enum_([
    BlogStatus.DRAFT,
    BlogStatus.PUBLISHED,
    BlogStatus.ARCHIVED,
  ]).optional(),
  categoryId: string().uuid().optional(),
  tagIds: array(string().uuid()).optional(),
  metaTitle: string().optional(),
  metaDescription: string().optional(),
});

export type UpdateBlogPostDto = _infer<typeof UpdateBlogPostDto>;
