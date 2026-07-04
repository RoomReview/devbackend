import {
  object,
  string,
  email,
  regexes,
  type infer as _infer,
} from 'zod';

export const SubscribeNewsletterDto = object({
  email: email({ pattern: regexes.email }),
});

export type SubscribeNewsletterDto = _infer<typeof SubscribeNewsletterDto>;

export const ConfirmNewsletterDto = object({
  confirmToken: string().min(1),
});

export type ConfirmNewsletterDto = _infer<typeof ConfirmNewsletterDto>;
