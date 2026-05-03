import { UserRole } from '@/generated/prisma/enums';
import {
  object,
  string,
  enum as enum_,
  regexes,
  email,
  type infer as _infer,
  uuid,
} from 'zod';

export const RegisterUserDto = object({
  email: email({ pattern: regexes.email }),
  password: string().min(6),
  firstName: string().min(1),
  lastName: string().min(1),
  role: enum_([
    UserRole['LANDLORD'],
    UserRole['TENANT'],
    UserRole['AGENCY'],
    UserRole['AGENT'],
  ]),
  agencyName: string().optional(),
  agencyDescription: string().optional(),
  agencyEmail: string().optional(),
  agencyPhone: string().optional(),
  agencyWebsite: string().optional(),
}).superRefine((data, ctx) => {
  if (
    (data.role === UserRole['AGENCY'] || data.role === UserRole['AGENT']) &&
    (!data.agencyName || data.agencyName.trim().length === 0)
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Agency name is required for agency or agent role',
      path: ['agencyName'],
    });
  }
});


export type RegisterUserDto = _infer<typeof RegisterUserDto>;

export const LoginUserDto = object({
  email: email({ pattern: regexes.email }),
  password: string().min(6),
});

export type LoginUserDto = _infer<typeof LoginUserDto>;

export const LogoutUserDto = object({
  userId: uuid(),
});

export type LogoutUserDto = _infer<typeof LogoutUserDto>;

export const VerifyEmailDto = object({
  email: email({ pattern: regexes.email }),
});

export type VerifyEmailDto = _infer<typeof VerifyEmailDto>;

export const VerifyEmailCodeDto = object({
  code: string().length(6),
  email: email({ pattern: regexes.email }),
});

export type VerifyEmailCodeDto = _infer<typeof VerifyEmailCodeDto>;

export const RefreshTokenDto = object({
  userId: uuid(),
  refreshToken: string().min(1),
});

export type RefreshTokenDto = _infer<typeof RefreshTokenDto>;

export const ForgotPasswordDto = object({
  email: email({ pattern: regexes.email }),
});

export type ForgotPasswordDto = _infer<typeof ForgotPasswordDto>;

export const ResetPasswordDto = object({
  email: email({ pattern: regexes.email }),
  code: string().length(6),
  newPassword: string().min(6),
});

export type ResetPasswordDto = _infer<typeof ResetPasswordDto>;
