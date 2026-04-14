/**
 * sso.controller.ts
 *
 * Handles the result of a completed Passport OAuth callback.
 * After Passport resolves, req.user contains an SsoTokenPayload.
 * We redirect to the frontend with the JWT tokens in the query string.
 */

import type { Request, Response } from 'express';
import type { SsoTokenPayload } from '@utils/sso.login';
import { logoutUser } from '@services/auth.service';
import config from '@config/index';
import logger, { LogContext } from '@utils/logger';
import type { AuthenticatedRequest } from '@/types';
import type { ApiResponse } from '@/types';

const logContext: LogContext = { service: 'SsoController', function: '' };

/**
 * Called after a successful OAuth callback.
 * Redirects the browser to the frontend with JWT tokens in query params.
 */
export const ssoCallback = (req: Request, res: Response): void => {
  logContext.function = 'ssoCallback';

  const payload = req.user as SsoTokenPayload | undefined;

  if (!payload) {
    logger.error(logContext, 'SSO callback missing user payload');
    res.redirect(
      `${config.frontendUrl}/auth/sso/error?reason=missing_payload`,
    );
    return;
  }

  const params = new URLSearchParams({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    userId: payload.userId,
    role: payload.role,
  });

  logger.info(logContext, 'SSO callback success — redirecting to frontend', {
    userId: payload.userId,
  });

  res.redirect(`${config.frontendUrl}/auth/sso/callback?${params.toString()}`);
};

/**
 * Called when Passport authentication fails (e.g. user denied OAuth consent).
 * Redirects the browser to the frontend error page.
 */
export const ssoFailure = (_req: Request, res: Response): void => {
  logContext.function = 'ssoFailure';
  logger.warn(logContext, 'SSO authentication failed');
  res.redirect(`${config.frontendUrl}/auth/sso/error?reason=sso_failed`);
};

/**
 * SSO logout — invalidates the JWT session for the authenticated user.
 * Reuses the same logoutUser service as the email/password flow.
 */
export const ssoLogout = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response> => {
  logContext.function = 'ssoLogout';

  const userId = req.user?.userId;
  if (!userId) {
    const response: ApiResponse<null> = {
      success: false,
      statusCode: 401,
      message: 'No authenticated user found',
      data: null,
    };
    return res.status(401).json(response);
  }

  await logoutUser(userId);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Logged out successfully',
    data: null,
  };

  return res.status(200).json(response);
};
