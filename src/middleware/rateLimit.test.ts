import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { rateLimit } from './rateLimit.middleware';

describe('rateLimit middleware', () => {
  it('blocks requests after the configured limit', () => {
    const ip = randomUUID();
    const middleware = rateLimit({
      name: `test-${ip}`,
      limit: 2,
      windowMs: 60_000,
      key: () => ip,
    });
    let responseStatus = 200;
    let nextCalls = 0;
    const req = {} as Request;
    const res = {
      setHeader: () => undefined,
      status: (status: number) => {
        responseStatus = status;
        return res;
      },
      json: () => res,
    } as unknown as Response;
    const next = () => {
      nextCalls += 1;
    };

    middleware(req, res, next);
    middleware(req, res, next);
    middleware(req, res, next);

    assert.equal(nextCalls, 2);
    assert.equal(responseStatus, 429);
  });
});
