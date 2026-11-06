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

const personName = string()
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be 100 characters or fewer')
  .regex(
    /^[\p{L}\p{M}]+(?:[ '\u2019.-][\p{L}\p{M}]+)*$/u,
    'Use letters only; spaces, apostrophes, hyphens and full stops are allowed',
  );

export const RegisterUserDto = object({
  email: email({ pattern: regexes.email }),
  inviteToken: string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
  password: string().min(6),
  firstName: personName,
  lastName: personName,
  role: enum_([
    UserRole['LANDLORD'],
    UserRole['TENANT'],
    UserRole['AGENCY'],
    UserRole['AGENT'],
  ]),
  agencyName: string().max(150).optional(),
  agencyDescription: string().optional(),
  agencyEmail: string().optional(),
  agencyPhone: string().max(50).optional(),
  agencyWebsite: string().optional(),
}).superRefine((data, ctx) => {
  if (data.inviteToken && data.role !== UserRole['AGENT']) {
    ctx.addIssue({
      code: 'custom',
      message: 'Agency invitations must be accepted with an agent account',
      path: ['role'],
    });
  }
  if (data.role === UserRole['AGENT'] && !data.inviteToken) {
    ctx.addIssue({
      code: 'custom',
      message: 'Agent accounts can only be created from an agency invitation',
      path: ['role'],
    });
  }
  if (data.role === UserRole['AGENCY']) {
    if (!data.inviteToken && (!data.agencyName || data.agencyName.trim().length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Agency name is required for agency accounts',
        path: ['agencyName'],
      });
    }
    if (!data.inviteToken && (!data.agencyPhone || data.agencyPhone.trim().length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Agency phone is required for agency accounts',
        path: ['agencyPhone'],
      });
    }
  }
});

export const EarlyAccessRegisterDto = object({
  firstName: personName,
  lastName: personName,
  email: email({ pattern: regexes.email }),
  password: string().min(8),
  role: enum_([UserRole['AGENCY']]),
  agencyName: string().trim().min(1).max(150),
  agencyPhone: string().trim().min(1).max(50),
});


export type RegisterUserDto = _infer<typeof RegisterUserDto>;
export type EarlyAccessRegisterDto = _infer<typeof EarlyAccessRegisterDto>;

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
  refreshToken: string().min(1),
});

export type RefreshTokenDto = _infer<typeof RefreshTokenDto>;

export const SsoExchangeCodeDto = object({
  code: string().length(43).regex(/^[A-Za-z0-9_-]{43}$/),
});

export type SsoExchangeCodeDto = _infer<typeof SsoExchangeCodeDto>;

export const ForgotPasswordDto = object({
  email: email({ pattern: regexes.email }).max(254),
});

export type ForgotPasswordDto = _infer<typeof ForgotPasswordDto>;

export const ResetPasswordDto = object({
  email: email({ pattern: regexes.email }).max(254),
  code: string().regex(/^[a-f0-9]{64}$/i),
  newPassword: string().min(6),
});

export type ResetPasswordDto = _infer<typeof ResetPasswordDto>;
