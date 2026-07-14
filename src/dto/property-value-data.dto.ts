import {
  object,
  string,
  number,
  type infer as _infer,
} from 'zod';

export const CreatePropertyValueDataDto = object({
  postcode: string().min(1),
  averageValue: number().positive(),
  growthRate: number(),
  salesVolume: number().int().nonnegative(),
  recordedDate: string().datetime(),
});

export type CreatePropertyValueDataDto = _infer<typeof CreatePropertyValueDataDto>;

export const UpdatePropertyValueDataDto = object({
  postcode: string().min(1).optional(),
  averageValue: number().positive().optional(),
  growthRate: number().optional(),
  salesVolume: number().int().nonnegative().optional(),
  recordedDate: string().datetime().optional(),
});

export type UpdatePropertyValueDataDto = _infer<typeof UpdatePropertyValueDataDto>;
