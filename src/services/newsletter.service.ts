import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import prisma from '@config/database';
import config from '@config/index';
import {
  sendNewsletterConfirmationEmail,
  sendNewsletterArticleEmail,
} from '@/utils/email';
import logger from '@/utils/logger';

const emailSchema = z.email().max(254);
const contactUpsertUrl = 'https://api.sendgrid.com/v3/marketing/contacts';
const contactSearchByEmailUrl =
  'https://api.sendgrid.com/v3/marketing/contacts/search/identifiers/email';
const suppressionUrl = 'https://api.sendgrid.com/v3/asm/groups';

export class NewsletterConfigurationError extends Error {}
export class NewsletterNotFoundError extends Error {}
export class NewsletterUnavailableError extends Error {}

interface Subscriber {
  newsletter_subscriber_id: string;
  email: string;
  confirmed: boolean;
  confirm_token: string | null;
  unsubscribe_token: string | null;
}

const getSendGridApiKey = () => {
  if (!config.sendGridNewsletterEnabled) {
    throw new NewsletterUnavailableError(
      'Newsletter signups are temporarily unavailable',
    );
  }
  if (!config.sendGridApiKey || !config.sendGridNewsletterListId) {
    throw new NewsletterConfigurationError(
      'Newsletter provider is not configured',
    );
  }
  return config.sendGridApiKey;
};

const sendGridRequest = async <T>(
  url: string,
  init: RequestInit,
  allowNotFound = false,
): Promise<T | undefined> => {
  const apiKey = getSendGridApiKey();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (allowNotFound && response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    logger.error(
      { service: 'Newsletter', function: 'sendGridRequest' },
      'SendGrid newsletter request failed',
      { status: response.status },
    );
    throw new NewsletterUnavailableError(
      'Newsletter provider could not complete the request',
    );
  }
  if (response.status === 204) {
    return undefined;
  }
  return (await response.json()) as T;
};

const removeNewsletterSuppression = async (email: string) => {
  await sendGridRequest(
    `${suppressionUrl}/${config.sendGridNewsletterUnsubscribeGroupId}/suppressions/${encodeURIComponent(email)}`,
    { method: 'DELETE' },
    true,
  );
};

const saveConfirmedSendGridContact = async (email: string) => {
  if (!config.sendGridNewsletterListId) {
    throw new NewsletterConfigurationError(
      'Newsletter contact list is not configured',
    );
  }
  await sendGridRequest(contactUpsertUrl, {
    method: 'PUT',
    body: JSON.stringify({
      list_ids: [config.sendGridNewsletterListId],
      contacts: [{ email }],
    }),
  });
};

const removeConfirmedSendGridContact = async (email: string) => {
  const result = await sendGridRequest<{
    result?: Record<string, { contact?: { id?: string } }>;
  }>(
    contactSearchByEmailUrl,
    {
      method: 'POST',
      body: JSON.stringify({ identifiers: [email] }),
    },
    true,
  );
  const contactId = result?.result?.[email]?.contact?.id;
  if (contactId) {
    const url = new URL(contactUpsertUrl);
    url.searchParams.set('ids', contactId);
    await sendGridRequest(url.toString(), { method: 'DELETE' });
  }
};

const findSubscriber = async (where: Record<string, string>) =>
  prisma.newsletter_subscribers.findFirst({
    where,
    select: {
      newsletter_subscriber_id: true,
      email: true,
      confirmed: true,
      confirm_token: true,
      unsubscribe_token: true,
    },
  }) as Promise<Subscriber | null>;

export const subscribeToNewsletter = async (inputEmail: string) => {
  const parsedEmail = emailSchema.safeParse(inputEmail.trim().toLowerCase());
  if (!parsedEmail.success) {
    throw new NewsletterConfigurationError('Enter a valid email address');
  }
  getSendGridApiKey();
  if (!config.sendGridNewsletterUnsubscribeGroupId) {
    throw new NewsletterConfigurationError(
      'Newsletter unsubscribe group is not configured',
    );
  }
  const email = parsedEmail.data;
  const existing = await findSubscriber({ email });

  if (existing?.confirmed) {
    return { status: 'already-subscribed' as const };
  }
  if (existing?.confirm_token) {
    return { status: 'confirmation-sent' as const };
  }

  const confirmToken = randomUUID();
  const unsubscribeToken = existing?.unsubscribe_token ?? randomUUID();
  const subscriberId = existing?.newsletter_subscriber_id ?? randomUUID();
  if (existing) {
    await prisma.newsletter_subscribers.update({
      where: { newsletter_subscriber_id: subscriberId },
      data: {
        confirm_token: confirmToken,
        unsubscribe_token: unsubscribeToken,
        updated_at: new Date(),
      },
    });
  } else {
    try {
      await prisma.newsletter_subscribers.create({
        data: {
          newsletter_subscriber_id: subscriberId,
          email,
          confirmed: false,
          confirm_token: confirmToken,
          unsubscribe_token: unsubscribeToken,
          updated_at: new Date(),
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return { status: 'confirmation-sent' as const };
      }
      throw error;
    }
  }
  try {
    await sendNewsletterConfirmationEmail(email, confirmToken);
  } catch (error) {
    if (existing) {
      await prisma.newsletter_subscribers.update({
        where: { newsletter_subscriber_id: subscriberId },
        data: { confirm_token: null, updated_at: new Date() },
      });
    } else {
      await prisma.newsletter_subscribers.delete({
        where: { newsletter_subscriber_id: subscriberId },
      });
    }
    throw error;
  }
  return { status: 'confirmation-sent' as const };
};

export const confirmNewsletterSubscription = async (token: string) => {
  const subscriber = await findSubscriber({ confirm_token: token });
  if (!subscriber) {
    throw new NewsletterNotFoundError(
      'This confirmation link is invalid or expired',
    );
  }
  if (subscriber.confirmed) {
    return { status: 'already-subscribed' as const };
  }

  if (!config.sendGridNewsletterUnsubscribeGroupId) {
    throw new NewsletterConfigurationError(
      'Newsletter unsubscribe group is not configured',
    );
  }
  await removeNewsletterSuppression(subscriber.email);
  await saveConfirmedSendGridContact(subscriber.email);
  await prisma.newsletter_subscribers.update({
    where: { newsletter_subscriber_id: subscriber.newsletter_subscriber_id },
    data: { confirmed: true, confirm_token: null, updated_at: new Date() },
  });
  return { status: 'subscribed' as const };
};

export const unsubscribeFromNewsletter = async (token: string) => {
  const subscriber = await findSubscriber({ unsubscribe_token: token });
  if (!subscriber) {
    throw new NewsletterNotFoundError('This unsubscribe link is invalid');
  }
  if (subscriber.confirmed) {
    if (!config.sendGridNewsletterUnsubscribeGroupId) {
      throw new NewsletterConfigurationError(
        'Newsletter unsubscribe group is not configured',
      );
    }
    await sendGridRequest(
      `${suppressionUrl}/${config.sendGridNewsletterUnsubscribeGroupId}/suppressions`,
      {
        method: 'POST',
        body: JSON.stringify({ recipient_emails: [subscriber.email] }),
      },
    );
    await removeConfirmedSendGridContact(subscriber.email);
    await prisma.newsletter_subscribers.update({
      where: { newsletter_subscriber_id: subscriber.newsletter_subscriber_id },
      data: { confirmed: false, updated_at: new Date() },
    });
  }
  return { status: 'unsubscribed' as const };
};

export const sendPublishedArticleNewsletterOnce = async (article: {
  id: string;
  title: string;
  summary: string;
  url: string;
}) => {
  if (!config.sendGridNewsletterEnabled) {
    return { status: 'disabled' as const };
  }
  getSendGridApiKey();
  if (!config.sendGridNewsletterUnsubscribeGroupId) {
    throw new NewsletterConfigurationError(
      'Newsletter unsubscribe group is not configured',
    );
  }

  const articleUrl = new URL(article.url);
  if (
    articleUrl.protocol !== 'https:' ||
    articleUrl.hostname !== new URL(config.websiteUrl).hostname
  ) {
    throw new NewsletterConfigurationError(
      'Article URL must use the configured RoomReview website',
    );
  }
  const acquired = await prisma.$queryRaw<Array<{ article_id: string }>>`
    INSERT INTO newsletter_article_deliveries (article_id, title, summary, url)
    VALUES (${article.id}, ${article.title}, ${article.summary}, ${articleUrl.toString()})
    ON CONFLICT (article_id) DO NOTHING
    RETURNING article_id
  `;
  if (acquired.length === 0) {
    return { status: 'already-queued' as const };
  }
  return { status: 'queued' as const };
};

let newsletterWorkerRunning = false;

const deliverNextPublishedArticle = async (): Promise<boolean> => {
  const [article] = await prisma.$queryRaw<
    Array<{
      article_id: string;
      title: string;
      summary: string;
      url: string;
    }>
  >`
    WITH next_article AS (
      SELECT article_id
      FROM newsletter_article_deliveries
      WHERE status = 'QUEUED'
      ORDER BY queued_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE newsletter_article_deliveries AS delivery
    SET status = 'SENDING'
    FROM next_article
    WHERE delivery.article_id = next_article.article_id
    RETURNING delivery.article_id, delivery.title, delivery.summary, delivery.url
  `;
  if (!article) {
    return false;
  }

  try {
    const subscribers = await prisma.newsletter_subscribers.findMany({
      where: { confirmed: true },
      select: { email: true, unsubscribe_token: true },
    });
    let deliveryError: unknown;
    for (const subscriber of subscribers) {
      try {
        if (!subscriber.unsubscribe_token) {
          throw new NewsletterConfigurationError(
            'A subscriber is missing an unsubscribe token',
          );
        }
        const unsubscribeUrl = new URL(
          `/api/v1/newsletter/unsubscribe/${encodeURIComponent(subscriber.unsubscribe_token)}`,
          config.websiteUrl,
        ).toString();
        await sendNewsletterArticleEmail(
          subscriber.email,
          article.title,
          article.summary,
          article.url,
          unsubscribeUrl,
          config.sendGridNewsletterUnsubscribeGroupId,
        );
      } catch (error) {
        deliveryError ??= error;
        logger.error(
          { service: 'Newsletter', function: 'deliverNextPublishedArticle' },
          'Failed to send article update to subscriber; this article will not be retried automatically',
          { articleId: article.article_id, error },
        );
      }
    }
    await prisma.newsletter_article_deliveries.update({
      where: { article_id: article.article_id },
      data: { status: deliveryError ? 'FAILED' : 'SENT', sent_at: new Date() },
    });
    if (deliveryError) {
      logger.error(
        { service: 'Newsletter', function: 'deliverNextPublishedArticle' },
        'Article update job completed with delivery failures; webhook retries are deduplicated',
        { articleId: article.article_id },
      );
    }
    return true;
  } catch (error) {
    await prisma.newsletter_article_deliveries.update({
      where: { article_id: article.article_id },
      data: { status: 'FAILED' },
    });
    logger.error(
      { service: 'Newsletter', function: 'deliverNextPublishedArticle' },
      'Article update job failed and will not be retried automatically',
      { articleId: article.article_id, error },
    );
    return true;
  }
};

export const processPendingNewsletterArticles = async () => {
  if (!config.sendGridNewsletterEnabled || newsletterWorkerRunning) {
    return;
  }
  newsletterWorkerRunning = true;
  try {
    while (await deliverNextPublishedArticle()) {
      // Drain the persisted queue before releasing the worker lock.
    }
  } finally {
    newsletterWorkerRunning = false;
  }
};

export const startNewsletterWorker = () => {
  if (!config.sendGridNewsletterEnabled) {
    return;
  }
  const runWorker = () => {
    void processPendingNewsletterArticles().catch((error: unknown) => {
      logger.error(
        { service: 'Newsletter', function: 'startNewsletterWorker' },
        'Newsletter worker poll failed',
        { error },
      );
    });
  };
  const timer = setInterval(() => {
    runWorker();
  }, 10_000);
  timer.unref();
  runWorker();
};
