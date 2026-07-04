import { InquiryStatus } from '@/generated/prisma/enums';
import {
  object,
  string,
  email,
  regexes,
  enum as enum_,
  type infer as _infer,
} from 'zod';

export const CreateContactInquiryDto = object({
  name: string().min(1),
  email: email({ pattern: regexes.email }),
  subject: string().min(1),
  message: string().min(1),
});

export type CreateContactInquiryDto = _infer<typeof CreateContactInquiryDto>;

export const UpdateContactInquiryStatusDto = object({
  status: enum_([
    InquiryStatus.NEW,
    InquiryStatus.IN_PROGRESS,
    InquiryStatus.RESOLVED,
    InquiryStatus.CLOSED,
  ]),
  adminNotes: string().optional(),
});

export type UpdateContactInquiryStatusDto = _infer<typeof UpdateContactInquiryStatusDto>;
