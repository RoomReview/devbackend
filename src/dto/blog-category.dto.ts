import { object, string, type infer as _infer } from 'zod';

export const CreateBlogCategoryDto = object({
  name: string().min(1),
  slug: string().min(1),
  description: string().optional(),
});

export type CreateBlogCategoryDto = _infer<typeof CreateBlogCategoryDto>;

export const UpdateBlogCategoryDto = object({
  name: string().min(1).optional(),
  slug: string().min(1).optional(),
  description: string().optional(),
});

export type UpdateBlogCategoryDto = _infer<typeof UpdateBlogCategoryDto>;
