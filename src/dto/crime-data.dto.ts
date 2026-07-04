import {
  object,
  string,
  number,
  type infer as _infer,
} from 'zod';

export const CreateCrimeDataDto = object({
  borough: string().min(1),
  crimeType: string().min(1),
  crimeCount: number().int().nonnegative(),
  recordedDate: string().datetime(),
});

export type CreateCrimeDataDto = _infer<typeof CreateCrimeDataDto>;

export const UpdateCrimeDataDto = object({
  borough: string().min(1).optional(),
  crimeType: string().min(1).optional(),
  crimeCount: number().int().nonnegative().optional(),
  recordedDate: string().datetime().optional(),
});

export type UpdateCrimeDataDto = _infer<typeof UpdateCrimeDataDto>;
