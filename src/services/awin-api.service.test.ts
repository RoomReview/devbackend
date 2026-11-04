import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getAwinPromotions,
  getAwinPublisherAccounts,
  parseAwinPromotions,
  parseAwinPublishers,
  parseAwinTransactions,
  summarizeAwinErrorBody,
} from './awin-api.service.ts';

describe('Awin API response parsing', () => {
  it('fetches active and upcoming joined GB offers with pagination', async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      requests.push({ url, init });
      return new Response('[]', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    try {
      assert.deepEqual(await getAwinPromotions(12345), []);
      assert.equal(requests.length, 2);
      for (const request of requests) {
        assert.equal(request.url.pathname, '/publisher/12345/promotions');
        assert.equal(request.url.searchParams.has('accessToken'), true);
        assert.equal(request.init?.method, 'POST');
        assert.equal(
          new Headers(request.init?.headers)
            .get('authorization')
            ?.startsWith('Bearer '),
          true,
        );
        assert.deepEqual(JSON.parse(String(request.init?.body)), {
          filters: {
            membership: 'all',
            regionCodes: ['GB'],
            status: JSON.parse(String(request.init?.body)).filters.status,
            type: 'all',
          },
          pagination: { page: 1, pageSize: 200 },
        });
      }
      assert.deepEqual(
        requests.map((request) => {
          const body = JSON.parse(String(request.init?.body));
          return body.filters.status;
        }),
        ['active', 'upcoming'],
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('parses joined promotions and rejects unjoined or unsafe tracking URLs', () => {
    const promotion = {
      promotionId: 456,
      advertiser: { id: 123, name: 'London Store', joined: true },
      title: '10% off',
      description: 'Save 10% on selected items.',
      terms: 'Minimum spend applies.',
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T23:59:59.000Z',
      urlTracking: 'https://www.awin1.com/cread.php?promotion=456',
      voucher: { code: 'SAVE10' },
    };
    const promotions = parseAwinPromotions([
      promotion,
      {
        ...promotion,
        promotionId: 457,
        advertiser: { ...promotion.advertiser, joined: false },
      },
      { ...promotion, promotionId: 458, urlTracking: 'http://awin1.com/deal' },
    ]);

    assert.deepEqual(
      promotions.map(({ promotionId, joined }) => ({ promotionId, joined })),
      [
        { promotionId: 456, joined: true },
        { promotionId: 457, joined: false },
      ],
    );
    assert.equal(
      promotions[0]?.trackingUrl,
      'https://www.awin1.com/cread.php?promotion=456',
    );
  });

  it('loads linked publisher accounts from the accounts endpoint', async () => {
    const originalFetch = globalThis.fetch;
    let requestUrl = '';
    globalThis.fetch = async (input, init) => {
      requestUrl = String(input);
      assert.equal(
        new Headers(init?.headers).get('authorization')?.startsWith('Bearer '),
        true,
      );
      return new Response(
        JSON.stringify([{ id: 12345, name: 'RoomReview Publisher' }]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    try {
      assert.deepEqual(await getAwinPublisherAccounts(), [
        { publisherId: 12345, name: 'RoomReview Publisher' },
      ]);
      assert.equal(requestUrl, 'https://api.awin.com/accounts');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('summarizes provider errors without logging the API token', () => {
    assert.equal(
      summarizeAwinErrorBody(
        '{"message":"Not found","accessToken":"private-token"}',
        'private-token',
      ),
      'message: Not found',
    );
  });

  it('limits non-JSON provider error details', () => {
    const details = summarizeAwinErrorBody('x'.repeat(700), 'private-token');
    assert.equal(details?.length, 500);
  });

  it('extracts publisher account IDs without exposing token data', () => {
    assert.deepEqual(
      parseAwinPublishers([
        { id: 12345, name: 'RoomReview Publisher' },
        { id: 'invalid', name: 'Invalid publisher' },
      ]),
      [{ publisherId: 12345, name: 'RoomReview Publisher' }],
    );
  });

  it('parses publisher account objects returned in an accounts envelope', () => {
    assert.deepEqual(
      parseAwinPublishers({
        accounts: [{ accountId: 12345, accountName: 'RoomReview Publisher' }],
      }),
      [{ publisherId: 12345, name: 'RoomReview Publisher' }],
    );
  });

  it('normalizes transaction status, amounts, dates and click references', () => {
    assert.deepEqual(
      parseAwinTransactions([
        {
          id: 123456,
          advertiserId: 67890,
          advertiserName: 'London Store',
          clickRef: 'rr-reward-ref',
          commissionStatus: 'approved',
          commissionAmount: '2.50',
          currency: 'gbp',
          transactionDate: '2026-10-31T12:30:00Z',
          validationDate: '2026-11-01T12:30:00Z',
        },
      ]),
      [
        {
          transactionId: '123456',
          advertiserId: '67890',
          advertiserName: 'London Store',
          clickReference: 'rr-reward-ref',
          status: 'approved',
          commission: 2.5,
          currency: 'GBP',
          transactionAt: new Date('2026-10-31T12:30:00Z'),
          validationAt: new Date('2026-11-01T12:30:00Z'),
        },
      ],
    );
  });

  it('keeps a missing commission amount null instead of converting it to zero', () => {
    const transactions = parseAwinTransactions([
      {
        id: 123,
        advertiserId: 456,
        commissionStatus: 'pending',
        transactionDate: '2026-10-01T12:00:00Z',
        commissionAmount: null,
      },
    ]);

    assert.equal(transactions[0]?.commission, null);
  });

  it('rejects transaction rows with unsupported statuses or incomplete identifiers', () => {
    assert.throws(() =>
      parseAwinTransactions([
        {
          id: 123456,
          advertiserId: 67890,
          status: 'unknown',
          transactionDate: '2026-10-31T12:30:00Z',
        },
      ]),
    );
  });
});
