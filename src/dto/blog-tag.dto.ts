import { object, string, type infer as _infer } from 'zod';

export const CreateBlogTagDto = object({
  name: string().min(1),
  slug: string().min(1),
});

export type CreateBlogTagDto = _infer<typeof CreateBlogTagDto>;

export const UpdateBlogTagDto = object({
  name: string().min(1).optional(),
  slug: string().min(1).optional(),
});

export type UpdateBlogTagDto = _infer<typeof UpdateBlogTagDto>;
