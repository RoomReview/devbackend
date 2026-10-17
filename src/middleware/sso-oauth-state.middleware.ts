import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import passport from 'passport';
import config from '@config/index';
import logger, { LogContext } from '@/utils/logger';

type SsoProvider = 'google' | 'facebook';

const logContext: LogContext = {
  service: 'SsoOAuthState',
  function: '',
};

const cookieName = (provider: SsoProvider) => `rr_sso_${provider}_state`;

const stateCookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const isValidState = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const getCookieValue = (cookieHeader: string | undefined, name: string) => {
  const cookie = cookieHeader
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? cookie.slice(name.length + 1) : null;
};

export const matchesSsoOAuthState = (
  suppliedState: unknown,
  storedState: string | null,
): suppliedState is string => {
  if (!isValidState(suppliedState) || !storedState || !isValidState(storedState)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(suppliedState), Buffer.from(storedState));
};

export const startSsoAuthentication = (
  provider: SsoProvider,
  scope: string[],
): RequestHandler => (req, res, next) => {
  const state = randomUUID();

  res.cookie(cookieName(provider), state, {
    ...stateCookieOptions,
    maxAge: 5 * 60 * 1000,
  });

  passport.authenticate(provider, {
    session: false,
    scope,
    state,
  })(req, res, next);
};

export const validateSsoOAuthState = (provider: SsoProvider): RequestHandler =>
  (req, res, next) => {
    logContext.function = 'validateSsoOAuthState';
    const name = cookieName(provider);
    const storedState = getCookieValue(req.headers.cookie, name);
    const suppliedState = req.query.state;

    res.clearCookie(name, stateCookieOptions);
    if (!matchesSsoOAuthState(suppliedState, storedState)) {
      logger.warn(logContext, 'Rejected SSO callback with invalid OAuth state', {
        provider,
      });
      res.redirect(`${config.frontendUrl}/auth/sso/error?reason=invalid_state`);
      return;
    }

    next();
  };
