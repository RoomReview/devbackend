import { object, string, type infer as _infer } from 'zod';

export const AreaReportPdfDto = object({
  html: string().max(500_000),
  css: string().max(450_000),
  postcode: string().trim().min(1).max(32),
});

export type AreaReportPdfRequest = _infer<typeof AreaReportPdfDto>;
