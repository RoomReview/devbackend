import type { NextFunction, Request, Response } from 'express';

import config from '@config/index';
import { RequestTimeoutError } from '@utils/custom-error';
import logger, { type LogContext } from '@utils/logger';

const logContext: LogContext = {
  service: 'TimeoutMiddleware',
  function: 'requestTimeout',
};

/**
 * Express middleware that enforces a maximum response time for requests.
 *
 * If the handler does not finish within the configured timeout, a
 * `RequestTimeoutError` (HTTP 408) is forwarded to the error handler.
 *
 * @param timeoutMs - Override the default timeout (from `config.requestTimeoutMs`).
 *                    Useful for per-route overrides on long-running endpoints.
 */
export const requestTimeout = (timeoutMs?: number) => {
  const ms = timeoutMs ?? config.requestTimeoutMs;

  return (_req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(logContext, `Request timed out after ${ms}ms`, {
          method: _req.method,
          url: _req.originalUrl,
        });

        next(
          new RequestTimeoutError({
            message: `Request timed out after ${ms}ms`,
            code: 'REQUEST_TIMEOUT',
          }),
        );
      }
    }, ms);

    // Prevent the timer from keeping the Node.js event loop alive
    timer.unref();

    // Clear when the response completes or the client disconnects
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
};
