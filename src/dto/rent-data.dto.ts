import {
  object,
  string,
  number,
  type infer as _infer,
} from 'zod';

export const CreateRentDataDto = object({
  postcode: string().min(1),
  propertyType: string().min(1),
  rent: number().positive(),
  date: string().datetime(),
  source: string().min(1),
});

export type CreateRentDataDto = _infer<typeof CreateRentDataDto>;

export const UpdateRentDataDto = object({
  postcode: string().min(1).optional(),
  propertyType: string().min(1).optional(),
  rent: number().positive().optional(),
  date: string().datetime().optional(),
  source: string().min(1).optional(),
});

export type UpdateRentDataDto = _infer<typeof UpdateRentDataDto>;
