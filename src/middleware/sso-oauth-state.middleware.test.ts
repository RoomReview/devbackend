import { mock, describe, it } from 'node:test';
import { equal, ok } from 'node:assert';
import type { Request, Response } from 'express';
import passport from 'passport';
import {
  matchesSsoOAuthState,
  startSsoAuthentication,
} from './sso-oauth-state.middleware.ts';

describe('SSO OAuth state validation', () => {
  const validState = 'b8eb0868-ff1e-4b24-9b4d-4fd8fe7d47c4';

  it('accepts only a matching valid state', () => {
    ok(matchesSsoOAuthState(validState, validState));
  });

  it('rejects missing, malformed, or mismatched state', () => {
    equal(matchesSsoOAuthState(undefined, validState), false);
    equal(matchesSsoOAuthState('not-a-uuid', 'not-a-uuid'), false);
    equal(matchesSsoOAuthState(validState, '2271c2d6-7c2e-493b-84d8-bd6095be7c41'), false);
    equal(matchesSsoOAuthState(validState, null), false);
  });

  it('generates OAuth state server-side instead of accepting a request state', () => {
    let cookieState = '';
    let passportState = '';
    mock.method(passport, 'authenticate', (_provider, options) => {
      passportState = options?.state ?? '';
      return (_req, _res, next) => next();
    });

    const req = { query: { state: validState } } as Request;
    const res = {
      cookie: (_name: string, value: string) => {
        cookieState = value;
        return res;
      },
    } as unknown as Response;

    startSsoAuthentication('google', [])(req, res, () => undefined);

    ok(/^[0-9a-f-]{36}$/i.test(cookieState));
    ok(cookieState !== validState);
    equal(passportState, cookieState);
  });
});
