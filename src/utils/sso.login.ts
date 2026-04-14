/**
 * sso.login.ts
 *
 * Configures Passport.js strategies for Google OAuth 2.0 and Facebook OAuth.
 * Session-less design: Passport verifies the OAuth identity, then we issue
 * our own JWT access/refresh tokens (same envelope as the regular loginUser flow).
 *
 * Exported:
 *   configurePassport(app) — registers both strategies on the Express app.
 *   SsoTokenPayload         — the shape attached to req.user after a successful OAuth callback.
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import type { Application } from 'express';
import config from '@config/index';
import { loginOrRegisterSsoUser } from '@services/auth.service';
import logger, { LogContext } from '@utils/logger';

const logContext: LogContext = { service: 'SsoLogin', function: '' };

export interface SsoTokenPayload {
  userId: string;
  email: string;
  role: string;
  accessToken: string;
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Google Strategy
// ---------------------------------------------------------------------------

function configureGoogleStrategy(): void {
  logContext.function = 'configureGoogleStrategy';

  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: config.googleCallbackUrl,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {

        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email returned from Google'), undefined);
          }

          const { user, session } = await loginOrRegisterSsoUser({
            provider: 'google',
            id: profile.id,
            email,
            firstName: profile.name?.givenName ?? profile.displayName,
            lastName: profile.name?.familyName ?? '',
          });

          const payload: SsoTokenPayload = {
            userId: user.userId,
            email: user.email,
            role: user.role,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
          };

          return done(null, payload);
        } catch (err) {
          logger.error(logContext, 'Google SSO strategy error', { error: err });
          return done(err as Error, undefined);
        }
      },
    ),
  );
}

// ---------------------------------------------------------------------------
// Facebook Strategy
// ---------------------------------------------------------------------------

function configureFacebookStrategy(): void {
  logContext.function = 'configureFacebookStrategy';

  passport.use(
    new FacebookStrategy(
      {
        clientID: config.facebookAppId,
        clientSecret: config.facebookAppSecret,
        callbackURL: config.facebookCallbackUrl,
        profileFields: ['id', 'emails', 'name'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email returned from Facebook'), undefined);
          }

          const { user, session } = await loginOrRegisterSsoUser({
            provider: 'facebook',
            id: profile.id,
            email,
            firstName: profile.name?.givenName ?? profile.displayName,
            lastName: profile.name?.familyName ?? '',
          });

          const payload: SsoTokenPayload = {
            userId: user.userId,
            email: user.email,
            role: user.role,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
          };

          return done(null, payload);
        } catch (err) {
          logger.error(logContext, 'Facebook SSO strategy error', { error: err });
          return done(err as Error, undefined);
        }
      },
    ),
  );
}

// ---------------------------------------------------------------------------
// Passport initialiser
// ---------------------------------------------------------------------------

/**
 * Registers Google and Facebook Passport strategies on the Express application.
 * Must be called once during app bootstrap, after express.json() middleware.
 * Session support is intentionally disabled — tokens are issued via JWT.
 */
export function configurePassport(app: Application): void {
  // No session serialisation needed (stateless JWT approach)
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user as Express.User));

  config.enableGoogleSSO && configureGoogleStrategy();
  config.enableFacebookSSO && configureFacebookStrategy();

  app.use(passport.initialize());

  logger.info(
    { service: 'SsoLogin', function: 'configurePassport' },
    'Passport SSO strategies registered (Google, Facebook)',
  );
}