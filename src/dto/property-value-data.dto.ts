import {
  object,
  string,
  number,
  type infer as _infer,
} from 'zod';

export const CreatePropertyValueDataDto = object({
  postcode: string().min(1),
  value: number().positive(),
  date: string().datetime(),
  source: string().min(1),
});

export type CreatePropertyValueDataDto = _infer<typeof CreatePropertyValueDataDto>;

export const UpdatePropertyValueDataDto = object({
  postcode: string().min(1).optional(),
  value: number().positive().optional(),
  date: string().datetime().optional(),
  source: string().min(1).optional(),
});

export type UpdatePropertyValueDataDto = _infer<typeof UpdatePropertyValueDataDto>;
