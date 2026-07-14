import {
  object,
  string,
  number,
  type infer as _infer,
} from 'zod';

export const CreateDemographyDto = object({
  postcode: string().min(1),
  ageGroup: string().min(1),
  percentage: number().min(0).max(100),
  date: string().datetime(),
  source: string().min(1),
});

export type CreateDemographyDto = _infer<typeof CreateDemographyDto>;

export const UpdateDemographyDto = object({
  postcode: string().min(1).optional(),
  ageGroup: string().min(1).optional(),
  percentage: number().min(0).max(100).optional(),
  date: string().datetime().optional(),
  source: string().min(1).optional(),
});

export type UpdateDemographyDto = _infer<typeof UpdateDemographyDto>;
