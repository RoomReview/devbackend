import {
  object,
  string,
  number,
  record,
  any,
  type infer as _infer,
} from 'zod';

export const CreateBoroughDto = object({
  name: string().min(1),
  slug: string().min(1),
  description: string().optional(),
  image: string().optional(),
  latitude: number().optional(),
  longitude: number().optional(),
  metrics: record(string(), any()).optional(),
});

export type CreateBoroughDto = _infer<typeof CreateBoroughDto>;

export const UpdateBoroughDto = object({
  name: string().min(1).optional(),
  slug: string().min(1).optional(),
  description: string().optional(),
  image: string().optional(),
  latitude: number().optional(),
  longitude: number().optional(),
  metrics: record(string(), any()).optional(),
});

export type UpdateBoroughDto = _infer<typeof UpdateBoroughDto>;
