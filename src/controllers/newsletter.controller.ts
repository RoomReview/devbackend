import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import config from '@/config';
import logger from '@/utils/logger';
import {
  confirmNewsletterSubscription,
  NewsletterConfigurationError,
  NewsletterNotFoundError,
  NewsletterUnavailableError,
  sendPublishedArticleNewsletterOnce,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '@/services/newsletter.service';

const subscribeSchema = z.object({ email: z.email().max(254) });
const publishedArticleSchema = z.object({
  id: z.union([
    z.string().min(1).max(100),
    z.number().int().positive().transform(String),
  ]),
  status: z.string(),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(5000),
  url: z.url(),
});
const getRouteToken = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
const plainText = (value: string): string =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

const renderMessage = (title: string, message: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · RoomReview</title></head><body style="font-family:Arial,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;color:#1a2b3c"><h1>${title}</h1><p>${message}</p><p><a href="${config.websiteUrl}">Return to RoomReview</a></p></body></html>`;

const sendServiceError = (res: Response, error: unknown): void => {
  if (error instanceof NewsletterNotFoundError) {
    res
      .status(404)
      .json({ success: false, statusCode: 404, error: error.message });
    return;
  }
  if (
    error instanceof NewsletterConfigurationError ||
    error instanceof NewsletterUnavailableError
  ) {
    res
      .status(503)
      .json({ success: false, statusCode: 503, error: error.message });
    return;
  }
  logger.error(
    { service: 'Newsletter', function: 'request' },
    'Newsletter request failed',
    { error },
  );
  res.status(502).json({
    success: false,
    statusCode: 502,
    error: 'Newsletter request could not be completed. Please try again later.',
  });
};

export const subscribe = async (req: Request, res: Response): Promise<void> => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        success: false,
        statusCode: 400,
        error: 'Enter a valid email address',
      });
    return;
  }
  try {
    const result = await subscribeToNewsletter(parsed.data.email);
    const message =
      result.status === 'already-subscribed'
        ? 'This email is already subscribed.'
        : 'Check your inbox to confirm your subscription.';
    res.status(result.status === 'already-subscribed' ? 200 : 202).json({
      success: true,
      statusCode: result.status === 'already-subscribed' ? 200 : 202,
      data: { status: result.status },
      message,
    });
  } catch (error) {
    sendServiceError(res, error);
  }
};

export const confirmSubscription = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await confirmNewsletterSubscription(getRouteToken(req.params.token));
    res
      .status(200)
      .type('html')
      .send(
        renderMessage(
          'Subscription confirmed',
          'You are subscribed to RoomReview article updates.',
        ),
      );
  } catch (error) {
    if (error instanceof NewsletterNotFoundError) {
      res
        .status(404)
        .type('html')
        .send(
          renderMessage(
            'Confirmation link unavailable',
            'This link is invalid or has already expired.',
          ),
        );
      return;
    }
    sendServiceError(res, error);
  }
};

export const showUnsubscribeConfirmation = (
  req: Request,
  res: Response,
): void => {
  const token = encodeURIComponent(getRouteToken(req.params.token));
  res
    .status(200)
    .type('html')
    .send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribe · RoomReview</title></head><body style="font-family:Arial,sans-serif;max-width:36rem;margin:4rem auto;padding:0 1rem;color:#1a2b3c"><h1>Unsubscribe from article updates</h1><p>Confirm below to stop receiving RoomReview article updates.</p><form method="post" action="/api/v1/newsletter/unsubscribe/${token}"><button type="submit">Unsubscribe</button></form></body></html>`,
    );
};

export const unsubscribe = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await unsubscribeFromNewsletter(getRouteToken(req.params.token));
    res
      .status(200)
      .type('html')
      .send(
        renderMessage(
          'You are unsubscribed',
          'You will no longer receive RoomReview article updates.',
        ),
      );
  } catch (error) {
    sendServiceError(res, error);
  }
};

export const articlePublishedWebhook = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (!config.newsletterWebhookSecret) {
    res
      .status(503)
      .json({
        success: false,
        statusCode: 503,
        error: 'Article update workflow is not configured',
      });
    return;
  }
  const suppliedSecret = req.header('x-newsletter-webhook-secret') ?? '';
  const expected = Buffer.from(config.newsletterWebhookSecret);
  const supplied = Buffer.from(suppliedSecret);
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    res
      .status(401)
      .json({ success: false, statusCode: 401, error: 'Unauthorized' });
    return;
  }

  const parsed = publishedArticleSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        success: false,
        statusCode: 400,
        error: 'Invalid article publication payload',
      });
    return;
  }
  if (parsed.data.status.toLowerCase() !== 'publish') {
    res
      .status(200)
      .json({ success: true, statusCode: 200, data: { status: 'ignored' } });
    return;
  }

  try {
    const result = await sendPublishedArticleNewsletterOnce({
      id: parsed.data.id,
      title: parsed.data.title,
      summary: plainText(parsed.data.summary),
      url: parsed.data.url,
    });
    res.status(202).json({ success: true, statusCode: 202, data: result });
  } catch (error) {
    sendServiceError(res, error);
  }
};
