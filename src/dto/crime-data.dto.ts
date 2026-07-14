import {
  object,
  string,
  number,
  type infer as _infer,
} from 'zod';

export const CreateCrimeDataDto = object({
  borough: string().min(1),
  crimeType: string().min(1).optional(),
  crimeRate: number().nonnegative(),
  date: string().datetime(),
  source: string().min(1),
});

export type CreateCrimeDataDto = _infer<typeof CreateCrimeDataDto>;

export const UpdateCrimeDataDto = object({
  borough: string().min(1).optional(),
  crimeType: string().min(1).optional(),
  crimeRate: number().nonnegative().optional(),
  date: string().datetime().optional(),
  source: string().min(1).optional(),
});

export type UpdateCrimeDataDto = _infer<typeof UpdateCrimeDataDto>;
