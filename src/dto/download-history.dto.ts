import { ReportType } from '@/generated/prisma/enums';
import {
  object,
  string,
  number,
  enum as enum_,
  type infer as _infer,
} from 'zod';

export const CreateDownloadHistoryDto = object({
  reportType: enum_([
    ReportType.BASE,
    ReportType.EXTENDED,
    ReportType.ADVANCED,
    ReportType.FULL_SINGLE,
    ReportType.FULL_DOUBLE,
    ReportType.VALUATION,
    ReportType.AI_SUMMARY,
  ]),
  format: string().min(1),
  postcode: string().optional(),
  borough: string().optional(),
  creditsUsed: number().int().nonnegative(),
});

export type CreateDownloadHistoryDto = _infer<typeof CreateDownloadHistoryDto>;
