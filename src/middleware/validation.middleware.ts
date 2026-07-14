import { ValidateRequestMiddlewareArgs } from '@/types';
import { ValidationError } from '@/utils/custom-error';
import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const validateRequest = <
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
>(
  schemas: ValidateRequestMiddlewareArgs<TBody, TParams, TQuery>,
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.params) {
        const parsedParams = schemas.params.parse(req.params) as any;
        for (const key in req.params) {
          delete req.params[key];
        }
        Object.assign(req.params, parsedParams);
      }
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query) as any;
        for (const key in req.query) {
          delete req.query[key];
        }
        Object.assign(req.query, parsedQuery);
      }
      return next();
    } catch (error) {
      let data = null;
      if (error instanceof ZodError) {
        data = error.issues || [];
      }
      return next(
        new ValidationError({
          message: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          data,
        }),
      );
    }
  };
};
