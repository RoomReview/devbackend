import { number, object, string, enum as enum_ } from 'zod';

const utcDate = string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, 'Enter a real calendar date');

export const SyncAwinTransactionsDto = object({
  publisherId: number().int().positive().safe(),
  startDate: utcDate,
  endDate: utcDate,
  dateType: enum_(['transaction', 'validation', 'amendment']),
})
  .strict()
  .refine(
    ({ startDate, endDate }) => {
      const start = Date.parse(`${startDate}T00:00:00.000Z`);
      const end = Date.parse(`${endDate}T23:59:59.000Z`);
      return start <= end && end - start <= 31 * 24 * 60 * 60 * 1000;
    },
    {
      message: 'The date range must be valid and no longer than 31 days',
      path: ['endDate'],
    },
  );

export const SyncAwinOffersDto = object({
  publisherId: number().int().positive().safe(),
  cursor: object({
    status: enum_(['active', 'upcoming']),
    page: number().int().positive().max(1000),
    syncStartedAt: string().datetime(),
  })
    .strict()
    .optional(),
}).strict();
