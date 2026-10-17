import { boolean as zBoolean, object, string, type infer as _infer } from 'zod';

export const ChangePasswordDto = object({
  oldPassword: string().min(6),
  newPassword: string().min(8).max(128),
}).refine((data) => data.oldPassword !== data.newPassword, {
  message: 'New password must be different from your current password',
  path: ['newPassword'],
});

export type ChangePasswordDto = _infer<typeof ChangePasswordDto>;

export const UpdateEmailPreferencesDto = object({
  emailOnReviewApproved: zBoolean(),
  emailOnReviewRejected: zBoolean(),
}).strict();

export type UpdateEmailPreferencesDto = _infer<typeof UpdateEmailPreferencesDto>;
