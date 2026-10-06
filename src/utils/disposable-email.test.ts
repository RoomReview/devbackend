import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDisposableEmail } from './disposable-email';

describe('isDisposableEmail', () => {
  it('blocks disposable email domains', () => {
    assert.equal(isDisposableEmail('person@mailinator.com'), true);
    assert.equal(isDisposableEmail('person@10minutemail.com'), true);
    assert.equal(isDisposableEmail('person@yopmail.com'), true);
  });

  it('blocks subdomains of disposable email domains', () => {
    assert.equal(isDisposableEmail('person@mail.mailinator.com'), true);
  });

  it('allows regular email domains', () => {
    assert.equal(isDisposableEmail('person@example.com'), false);
  });
});
