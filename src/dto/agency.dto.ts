import {
  object,
  string,
  boolean,
  email,
  regexes,
  type infer as _infer,
} from 'zod';

export const CreateAgencyDto = object({
  name: string().min(1),
  description: string().optional(),
  email: email({ pattern: regexes.email }).optional(),
  phone: string().optional(),
  website: string().optional(),
});

export type CreateAgencyDto = _infer<typeof CreateAgencyDto>;

export const UpdateAgencyDto = object({
  name: string().min(1).optional(),
  description: string().optional(),
  email: email({ pattern: regexes.email }).optional(),
  phone: string().optional(),
  website: string().optional(),
});

export type UpdateAgencyDto = _infer<typeof UpdateAgencyDto>;

export const VerifyAgencyDto = object({
  isVerified: boolean(),
});

export type VerifyAgencyDto = _infer<typeof VerifyAgencyDto>;
