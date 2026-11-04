import { object, string, uuid } from 'zod';

export const CreateBlogPostDto = object({
  title: string().trim().min(1).max(200),
  excerpt: string().trim().max(5000).optional(),
  content: string().trim().min(1).max(6000000),
}).strict();

export const BlogPostIdParamsDto = object({ id: uuid() }).strict();
