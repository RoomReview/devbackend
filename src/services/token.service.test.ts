import { equal, ok } from 'node:assert';
import { describe, it } from 'node:test';
import {
    generateVerificationCode,
    isCodeExpired,
    verifyCode,
} from './token.service';

describe('token.service', () => {
  describe('generateVerificationCode', () => {
    it('should generate a code between 100000 and 999999', () => {
      const result = generateVerificationCode();
      const codeNum = parseInt(result.code, 10);
      equal(result.code.length, 6);
      equal(typeof codeNum, 'number');
      equal(codeNum, result.code);
      equal(codeNum >= 100000 && codeNum <= 999999, true);
    });

    it('should generate a hashed code', () => {
      const result = generateVerificationCode();
      ok(result.hashedCode);
      equal(typeof result.hashedCode, 'string');
      equal(result.hashedCode.length, 64); // SHA256 hex length
    });

    it('should set expiration time to 15 minutes from now', () => {
      const before = Date.now();
      const result = generateVerificationCode();
      const after = Date.now();
      const expectedExpiration = 15 * 60 * 1000;
      const actualExpiration = result.expiresAt.getTime() - before;
      ok(
        actualExpiration >= expectedExpiration - 100 &&
          actualExpiration <= expectedExpiration + 100,
      );
    });
  });

  describe('verifyCode', () => {
    it('should return true for matching code', () => {
      const { code, hashedCode } = generateVerificationCode();
      ok(verifyCode(code, hashedCode));
    });

    it('should return false for non-matching code', () => {
      const { hashedCode } = generateVerificationCode();
      ok(!verifyCode('123456', hashedCode));
    });
  });

  describe('isCodeExpired', () => {
    it('should return false for future expiration time', () => {
      const futureDate = new Date(Date.now() + 1000);
      ok(!isCodeExpired(futureDate));
    });

    it('should return true for past expiration time', () => {
      const pastDate = new Date(Date.now() - 1000);
      ok(isCodeExpired(pastDate));
    });
  });
});
