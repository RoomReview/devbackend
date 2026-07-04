import { object, string, type infer as _infer } from 'zod';

export const UpdateUserProfileDto = object({
  firstName: string().min(1).optional(),
  lastName: string().min(1).optional(),
  phone: string().optional(),
  avatar: string().optional(),
  bio: string().optional(),
});

export type UpdateUserProfileDto = _infer<typeof UpdateUserProfileDto>;
