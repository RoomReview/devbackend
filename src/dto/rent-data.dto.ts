import {
  object,
  string,
  number,
  type infer as _infer,
} from 'zod';

export const CreateRentDataDto = object({
  postcode: string().min(1),
  propertyType: string().min(1),
  bedrooms: number().int().positive(),
  averageRent: number().positive(),
  minRent: number().positive(),
  maxRent: number().positive(),
  sampleSize: number().int().nonnegative(),
  recordedDate: string().datetime(),
});

export type CreateRentDataDto = _infer<typeof CreateRentDataDto>;

export const UpdateRentDataDto = object({
  postcode: string().min(1).optional(),
  propertyType: string().min(1).optional(),
  bedrooms: number().int().positive().optional(),
  averageRent: number().positive().optional(),
  minRent: number().positive().optional(),
  maxRent: number().positive().optional(),
  sampleSize: number().int().nonnegative().optional(),
  recordedDate: string().datetime().optional(),
});

export type UpdateRentDataDto = _infer<typeof UpdateRentDataDto>;
