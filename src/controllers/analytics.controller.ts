import type { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '@config/database';
import type { ApiResponse } from '@/types';
import { redactAnalyticsUrl } from '@/utils/analytics-url';

const analyticsEventSchema = z.object({
  eventName: z.literal('page_view'),
  anonymousId: z.string().uuid(),
  path: z.string().trim().min(1).max(2048),
  referrer: z.string().trim().max(2048).optional(),
});

export const createEvent = async (req: Request, res: Response): Promise<void> => {
  const parsedEvent = analyticsEventSchema.safeParse(req.body);

  if (!parsedEvent.success) {
    res.status(400).json({
      success: false,
      statusCode: 400,
      error: 'Invalid analytics event',
    } satisfies ApiResponse);
    return;
  }

  await prisma.analyticsEvent.create({
    data: {
      ...parsedEvent.data,
      path: redactAnalyticsUrl(parsedEvent.data.path),
      referrer: parsedEvent.data.referrer
        ? redactAnalyticsUrl(parsedEvent.data.referrer)
        : undefined,
    },
  });

  res.status(201).json({
    success: true,
    statusCode: 201,
    data: null,
    message: 'Analytics event recorded',
  } satisfies ApiResponse<null>);
};
