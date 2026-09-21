import type { ApiResponse } from '@/types/index';
import { CustomError, RouteNotFoundError } from '@utils/custom-error';
import logger from '@utils/logger';
import type { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
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

  logger.error(
    { service: 'HTTP', function: 'errorHandler' },
    `${err.statusCode ?? 500} ${err.message}`,
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
    error: (process.env.NODE_ENV === 'development' && err?.stack) || undefined,
    statusCode: err.statusCode ?? 500,
    status: err.status ?? 'error',
  };

  if (err instanceof CustomError) {
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
