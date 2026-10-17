import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { Request, Response } from 'express';
import config from '@/config';
import { articlePublishedWebhook } from './newsletter.controller';

const originalSecret = config.newsletterWebhookSecret;

const createRequest = (secret = '', body: unknown = {}) => ({
  body,
  header: (name: string) => name.toLowerCase() === 'x-newsletter-webhook-secret' ? secret : undefined,
}) as unknown as Request;

const createResponse = () => {
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return response as typeof response & Response;
};

afterEach(() => {
  (config as { newsletterWebhookSecret: string }).newsletterWebhookSecret = originalSecret;
});

describe('article published newsletter webhook', () => {
  it('rejects webhook calls when the shared secret is not configured', async () => {
    (config as { newsletterWebhookSecret: string }).newsletterWebhookSecret = '';
    const response = createResponse();

    await articlePublishedWebhook(createRequest(), response);

    assert.equal(response.statusCode, 503);
  });

  it('rejects requests with an invalid shared secret', async () => {
    (config as { newsletterWebhookSecret: string }).newsletterWebhookSecret = 'expected-secret';
    const response = createResponse();

    await articlePublishedWebhook(createRequest('incorrect-secret'), response);

    assert.equal(response.statusCode, 401);
  });

  it('ignores draft events without creating a delivery job', async () => {
    (config as { newsletterWebhookSecret: string }).newsletterWebhookSecret = 'expected-secret';
    const response = createResponse();

    await articlePublishedWebhook(
      createRequest('expected-secret', {
        id: 42,
        status: 'draft',
        title: 'Draft article',
        summary: 'Not published',
        url: 'https://roomreview.co.uk/blog/draft-article',
      }),
      response,
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, {
      success: true,
      statusCode: 200,
      data: { status: 'ignored' },
    });
  });
});
