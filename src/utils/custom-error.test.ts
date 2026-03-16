import { describe, it } from 'node:test';
import { equal, ok, strictEqual } from 'node:assert';
import {
  CustomError,
  EntityNotFoundError,
  InternalServerError,
  RouteNotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ErrorCodes,
} from './custom-error.ts';

describe('custom-error', () => {
  // ─── CustomError base class ───────────────────────────────────────────────────

  describe('CustomError', () => {
    it('should store message, statusCode, code, and data from constructor', () => {
      const err = new CustomError({
        message: 'Something went wrong',
        statusCode: 418,
        code: 'INTERNAL_SERVER_ERROR',
        data: { detail: 'test' },
      });

      equal(err.message, 'Something went wrong');
      equal(err.statusCode, 418);
      equal(err.code, 'INTERNAL_SERVER_ERROR');
      strictEqual((err.data as { detail: string }).detail, 'test');
    });

    it('should be an instance of Error', () => {
      const err = new CustomError({ message: 'base error' });
      ok(err instanceof Error);
    });

    it('should allow optional fields to be undefined', () => {
      const err = new CustomError({ message: 'minimal' });
      equal(err.statusCode, undefined);
      equal(err.code, undefined);
      equal(err.data, undefined);
    });
  });

  // ─── ErrorCodes ──────────────────────────────────────────────────────────────

  describe('ErrorCodes', () => {
    it('should export the four expected code strings', () => {
      strictEqual(ErrorCodes.ENTITY_NOT_FOUND, 'ENTITY_NOT_FOUND');
      strictEqual(ErrorCodes.INTERNAL_SERVER_ERROR, 'INTERNAL_SERVER_ERROR');
      strictEqual(ErrorCodes.ROUTE_NOT_FOUND, 'ROUTE_NOT_FOUND');
      strictEqual(ErrorCodes.VALIDATION_ERROR, 'VALIDATION_ERROR');
    });
  });

  // ─── EntityNotFoundError ─────────────────────────────────────────────────────

  describe('EntityNotFoundError', () => {
    it('should have a default statusCode of 404', () => {
      const err = new EntityNotFoundError({ message: 'Not found', code: 'ENTITY_NOT_FOUND' });
      equal(err.statusCode, 404);
    });

    it('should be an instance of CustomError and Error', () => {
      const err = new EntityNotFoundError({ message: 'Not found' });
      ok(err instanceof CustomError);
      ok(err instanceof Error);
    });

    it('should preserve the supplied message', () => {
      const err = new EntityNotFoundError({ message: 'User not found' });
      equal(err.message, 'User not found');
    });
  });

  // ─── InternalServerError ─────────────────────────────────────────────────────

  describe('InternalServerError', () => {
    it('should have a default statusCode of 500', () => {
      const err = new InternalServerError({ message: 'Server crashed' });
      equal(err.statusCode, 500);
    });

    it('should be an instance of CustomError', () => {
      ok(new InternalServerError({ message: 'err' }) instanceof CustomError);
    });

    it('should carry optional data payload', () => {
      const data = { stack: 'trace...' };
      const err = new InternalServerError({ message: 'oops', data });
      strictEqual(err.data, data);
    });
  });

  // ─── RouteNotFoundError ───────────────────────────────────────────────────────

  describe('RouteNotFoundError', () => {
    it('should have a default statusCode of 404', () => {
      const err = new RouteNotFoundError({ message: 'Route not found' });
      equal(err.statusCode, 404);
    });

    it('should be an instance of CustomError', () => {
      ok(new RouteNotFoundError({ message: 'err' }) instanceof CustomError);
    });
  });

  // ─── ValidationError ─────────────────────────────────────────────────────────

  describe('ValidationError', () => {
    it('should have a default statusCode of 400', () => {
      const err = new ValidationError({ message: 'Bad input', code: 'VALIDATION_ERROR' });
      equal(err.statusCode, 400);
    });

    it('should be an instance of CustomError', () => {
      ok(new ValidationError({ message: 'err' }) instanceof CustomError);
    });

    it('should store validation details in data', () => {
      const details = [{ field: 'email', issue: 'invalid format' }];
      const err = new ValidationError({ message: 'Validation failed', data: details });
      strictEqual(err.data, details);
    });
  });

  // ─── UnauthorizedError ────────────────────────────────────────────────────────

  describe('UnauthorizedError', () => {
    it('should have a default statusCode of 401', () => {
      const err = new UnauthorizedError({ message: 'Unauthorized' });
      equal(err.statusCode, 401);
    });

    it('should be an instance of CustomError', () => {
      ok(new UnauthorizedError({ message: 'err' }) instanceof CustomError);
    });
  });

  // ─── ForbiddenError ───────────────────────────────────────────────────────────

  describe('ForbiddenError', () => {
    it('should have a default statusCode of 403', () => {
      const err = new ForbiddenError({ message: 'Forbidden' });
      equal(err.statusCode, 403);
    });

    it('should be an instance of CustomError', () => {
      ok(new ForbiddenError({ message: 'err' }) instanceof CustomError);
    });
  });
});
