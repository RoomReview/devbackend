import { describe, it } from 'node:test';
import { equal } from 'node:assert';
import { redactAnalyticsUrl } from './analytics-url.ts';

describe('analytics URL redaction', () => {
  it('redacts bearer tokens and one-time codes while preserving ordinary parameters', () => {
    equal(
      redactAnalyticsUrl(
        '/auth?next=%2Faccount&accessToken=abc&refresh_token=def&code=ghi#code=fragment',
      ),
      '/auth?next=%2Faccount&accessToken=%5BREDACTED%5D&refresh_token=%5BREDACTED%5D&code=%5BREDACTED%5D',
    );
  });

  it('redacts case-insensitive token aliases and removes fragments', () => {
    equal(
      redactAnalyticsUrl('/account?ID_TOKEN=abc&client-secret=def#private'),
      '/account?ID_TOKEN=%5BREDACTED%5D&client-secret=%5BREDACTED%5D',
    );
  });

  it('removes a fragment even when there are no query parameters', () => {
    equal(redactAnalyticsUrl('/auth/sso/callback#code=private'), '/auth/sso/callback');
  });
});
