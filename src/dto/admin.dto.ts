import { number, object, string } from 'zod';

export const GrantReportCreditsDto = object({
  email: string().trim().email().max(254),
  credits: number().int().min(1).max(1000),
}).strict();
