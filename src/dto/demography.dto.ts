import {
  object,
  string,
  number,
  type infer as _infer,
} from 'zod';

export const CreateDemographyDto = object({
  postcode: string().min(1),
  population: number().int().positive(),
  medianAge: number().positive(),
  socialGrade: string().optional(),
  recordedDate: string().datetime(),
});

export type CreateDemographyDto = _infer<typeof CreateDemographyDto>;

export const UpdateDemographyDto = object({
  postcode: string().min(1).optional(),
  population: number().int().positive().optional(),
  medianAge: number().positive().optional(),
  socialGrade: string().optional(),
  recordedDate: string().datetime().optional(),
});

export type UpdateDemographyDto = _infer<typeof UpdateDemographyDto>;
