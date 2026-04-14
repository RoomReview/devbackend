import { object, string, type infer as _infer } from 'zod';

export const ChangePasswordDto = object({
  oldPassword: string().min(6),
  newPassword: string().min(6),
});

export type ChangePasswordDto = _infer<typeof ChangePasswordDto>;
