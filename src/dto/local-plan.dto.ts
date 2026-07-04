import {
  object,
  string,
  type infer as _infer,
} from 'zod';

export const CreateLocalPlanDto = object({
  borough: string().min(1),
  title: string().min(1),
  documentUrl: string().min(1),
  adoptionDate: string().datetime(),
  status: string().min(1),
  category: string().min(1),
  summary: string().min(1),
});

export type CreateLocalPlanDto = _infer<typeof CreateLocalPlanDto>;

export const UpdateLocalPlanDto = object({
  borough: string().min(1).optional(),
  title: string().min(1).optional(),
  documentUrl: string().min(1).optional(),
  adoptionDate: string().datetime().optional(),
  status: string().min(1).optional(),
  category: string().min(1).optional(),
  summary: string().min(1).optional(),
});

export type UpdateLocalPlanDto = _infer<typeof UpdateLocalPlanDto>;
