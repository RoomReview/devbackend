import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SyncAwinTransactionsDto } from './awin-transaction.dto.ts';

describe('Awin transaction sync validation', () => {
  it('accepts a valid publisher and date range', () => {
    assert.equal(
      SyncAwinTransactionsDto.safeParse({
        publisherId: 12345,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        dateType: 'transaction',
      }).success,
      true,
    );
  });

  it('rejects invalid dates, reversed ranges, and ranges over 31 days', () => {
    assert.equal(
      SyncAwinTransactionsDto.safeParse({
        publisherId: 12345,
        startDate: '2026-02-30',
        endDate: '2026-03-01',
        dateType: 'transaction',
      }).success,
      false,
    );
    assert.equal(
      SyncAwinTransactionsDto.safeParse({
        publisherId: 12345,
        startDate: '2026-10-02',
        endDate: '2026-10-01',
        dateType: 'validation',
      }).success,
      false,
    );
    assert.equal(
      SyncAwinTransactionsDto.safeParse({
        publisherId: 12345,
        startDate: '2026-01-01',
        endDate: '2026-02-02',
        dateType: 'transaction',
      }).success,
      false,
    );
  });
});
