import {
  object,
  string,
  type infer as _infer,
} from 'zod';

export const CreateLocalPlanDto = object({
  borough: string().min(1),
  category: string().min(1),
  summary: string().min(1),
  indicator: string().optional().nullable(),
  forecastChange: string().optional().nullable(),
  source: string().min(1),
});

export type CreateLocalPlanDto = _infer<typeof CreateLocalPlanDto>;

export const UpdateLocalPlanDto = object({
  borough: string().min(1).optional(),
  category: string().min(1).optional(),
  summary: string().min(1).optional(),
  indicator: string().optional().nullable().optional(),
  forecastChange: string().optional().nullable().optional(),
  source: string().min(1).optional(),
});

export type UpdateLocalPlanDto = _infer<typeof UpdateLocalPlanDto>;
