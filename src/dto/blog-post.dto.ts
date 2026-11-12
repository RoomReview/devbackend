import { enum as enum_, object, string, uuid } from 'zod';

const featuredImagePath = string()
  .max(160)
  .regex(
    /^\/api\/v1\/blog\/posts\/featured-images\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/,
  )
  .nullable()
  .optional();

export const CreateBlogPostDto = object({
  title: string().trim().min(1).max(200),
  author: string().trim().min(1).max(120).optional(),
  excerpt: string().trim().max(5000).optional(),
  content: string().trim().min(1),
  featuredImage: featuredImagePath,
}).strict();

export const UploadBlogFeaturedImageDto = object({
  contentType: enum_(['image/jpeg', 'image/png', 'image/webp']),
  imageBase64: string().min(1).max(7_500_000),
}).strict();

export const BlogPostIdParamsDto = object({ id: uuid() }).strict();
