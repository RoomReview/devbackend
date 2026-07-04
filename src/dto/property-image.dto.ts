import {
  object,
  string,
  number,
  type infer as _infer,
} from 'zod';

export const CreatePropertyImageDto = object({
  url: string().url(),
  alt: string().optional(),
  order: number().int().nonnegative().optional(),
});

export type CreatePropertyImageDto = _infer<typeof CreatePropertyImageDto>;

export const UpdatePropertyImageDto = object({
  alt: string().optional(),
  order: number().int().nonnegative().optional(),
});

export type UpdatePropertyImageDto = _infer<typeof UpdatePropertyImageDto>;
