import assert from 'node:assert';
import { describe, it } from 'node:test';
import { getPlanMonthlyReportAllowance } from './payment.service';

describe('subscription report allowances', () => {
  it('grants 10 reports per person including the account owner', () => {
    assert.strictEqual(getPlanMonthlyReportAllowance('individual'), 20);
    assert.strictEqual(getPlanMonthlyReportAllowance('small-team'), 60);
    assert.strictEqual(getPlanMonthlyReportAllowance('branch'), 110);
  });
});
