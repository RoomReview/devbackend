import type { ApiResponse } from '@/types/index';
import { CustomError, RouteNotFoundError } from '@utils/custom-error';
import logger from '@utils/logger';
import type { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
  type?: string;
  code?: string;
  data?: any;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const isPayloadTooLarge = err.type === 'entity.too.large';
  const statusCode = err.statusCode ?? (isPayloadTooLarge ? 413 : 500);
  const logError =
    statusCode === 401 || statusCode === 413 || statusCode === 429
      ? logger.warn
      : logger.error;
  logError(
    { service: 'HTTP', function: 'errorHandler' },
    `${statusCode} ${err.message}`,
    {
      requestId: (req as Request & { id?: string }).id ?? '-',
      method: req.method,
      url: req.originalUrl,
      code: err.code,
      error: err,
    },
  );

  const responseObj: ApiResponse = {
    success: false,
    message: err.message,
    data: err?.data ?? undefined,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    statusCode,
    status: err.status ?? 'error',
  };

  if (err instanceof CustomError || isPayloadTooLarge) {
    responseObj.error = err?.code;
    res.status(responseObj.statusCode).json(responseObj);
    return;
  }

  res.status(500).json(responseObj);
};

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!req.route) {
    const err = new RouteNotFoundError({
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
    });
    next(err);
  } else {
    next();
  }
};
