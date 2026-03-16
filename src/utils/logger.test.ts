import { describe, it, beforeEach, afterEach } from 'node:test';
import { ok, equal, match } from 'node:assert';
import logger from './logger.ts';

// ─── Capture helpers ──────────────────────────────────────────────────────────

type CapturedCall = { args: unknown[] };

/**
 * Temporarily replaces a console method with a spy that records calls.
 * Returns both the recorded calls array and a restore function.
 */
function spyOn(method: 'log' | 'warn' | 'error' | 'debug'): {
  calls: CapturedCall[];
  restore: () => void;
} {
  const calls: CapturedCall[] = [];
  const original = console[method];
  console[method] = (...args: unknown[]) => {
    calls.push({ args });
  };
  return {
    calls,
    restore: () => {
      console[method] = original;
    },
  };
}

const logContext = { service: 'TestService', function: 'testFn' };

describe('logger', () => {
  // ─── Format verification ─────────────────────────────────────────────────────

  describe('log formatting', () => {
    it('logger.info should include service, function, level and message in output', () => {
      const spy = spyOn('log');
      try {
        logger.info(logContext, 'hello from info');
      } finally {
        spy.restore();
      }

      ok(spy.calls.length > 0, 'expected console.log to be called');
      const formatted = spy.calls[0]!.args[0] as string;
      ok(formatted.includes('[TestService]'), 'should include service name');
      ok(formatted.includes('[testFn]'), 'should include function name');
      ok(formatted.includes('[INFO]'), 'should include log level');
      ok(formatted.includes('hello from info'), 'should include message');
    });

    it('logger.warn should include [WARN] in output', () => {
      const spy = spyOn('warn');
      try {
        logger.warn(logContext, 'warning message');
      } finally {
        spy.restore();
      }
      ok(spy.calls.length > 0, 'expected console.warn to be called');
      ok((spy.calls[0]!.args[0] as string).includes('[WARN]'));
    });

    it('logger.error should include [ERROR] in output', () => {
      const spy = spyOn('error');
      try {
        logger.error(logContext, 'error message');
      } finally {
        spy.restore();
      }
      ok(spy.calls.length > 0, 'expected console.error to be called');
      ok((spy.calls[0]!.args[0] as string).includes('[ERROR]'));
    });

    it('formatted string should contain an ISO timestamp', () => {
      const spy = spyOn('log');
      try {
        logger.info(logContext, 'ts check');
      } finally {
        spy.restore();
      }
      match(
        spy.calls[0]!.args[0] as string,
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
        'expected ISO 8601 timestamp in log output',
      );
    });

    it('should pass extra data as the second argument to console method', () => {
      const extraData = { userId: 'abc123' };
      const spy = spyOn('log');
      try {
        logger.info(logContext, 'with data', extraData);
      } finally {
        spy.restore();
      }
      equal(spy.calls[0]!.args[1], extraData);
    });
  });

  // ─── Log level filtering ──────────────────────────────────────────────────────

  describe('log level filtering', () => {
    let originalLevel: string | undefined;

    beforeEach(() => {
      originalLevel = process.env.LOG_LEVEL;
    });

    afterEach(() => {
      if (originalLevel === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = originalLevel;
      }
    });

    it('should suppress DEBUG messages when LOG_LEVEL is INFO', () => {
      process.env.LOG_LEVEL = 'INFO';
      const spy = spyOn('debug');
      try {
        logger.debug(logContext, 'should be suppressed');
      } finally {
        spy.restore();
      }
      equal(spy.calls.length, 0, 'DEBUG should be suppressed at INFO level');
    });

    it('should output DEBUG messages when LOG_LEVEL is DEBUG', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      const spy = spyOn('debug');
      try {
        logger.debug(logContext, 'should appear');
      } finally {
        spy.restore();
      }
      ok(spy.calls.length > 0, 'DEBUG should be output when LOG_LEVEL=DEBUG');
    });

    it('should suppress INFO and WARN when LOG_LEVEL is ERROR', () => {
      process.env.LOG_LEVEL = 'ERROR';

      const logSpy = spyOn('log');
      const warnSpy = spyOn('warn');
      try {
        logger.info(logContext, 'info at ERROR level');
        logger.warn(logContext, 'warn at ERROR level');
      } finally {
        logSpy.restore();
        warnSpy.restore();
      }
      equal(logSpy.calls.length, 0, 'INFO should be suppressed at ERROR level');
      equal(
        warnSpy.calls.length,
        0,
        'WARN should be suppressed at ERROR level',
      );
    });

    it('should still output ERROR when LOG_LEVEL is ERROR', () => {
      process.env.LOG_LEVEL = 'ERROR';
      const spy = spyOn('error');
      try {
        logger.error(logContext, 'critical failure');
      } finally {
        spy.restore();
      }
      ok(spy.calls.length > 0, 'ERROR should be output when LOG_LEVEL=ERROR');
    });

    it('should fall back to INFO level for an unknown LOG_LEVEL value', () => {
      process.env.LOG_LEVEL = 'VERBOSE'; // not a valid level
      const logSpy = spyOn('log');
      const debugSpy = spyOn('debug');
      try {
        logger.info(logContext, 'info at unknown level');
        logger.debug(logContext, 'debug at unknown level');
      } finally {
        logSpy.restore();
        debugSpy.restore();
      }
      ok(
        logSpy.calls.length > 0,
        'INFO should be output (fallback level is INFO)',
      );
      equal(
        debugSpy.calls.length,
        0,
        'DEBUG should be suppressed at default INFO level',
      );
    });
  });
});
