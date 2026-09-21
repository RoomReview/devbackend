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
        schemas.body.parse(req.body);
      }
      if (schemas.params) {
        schemas.params.parse(req.params) as any;
      }
      if (schemas.query) {
        schemas.query.parse(req.query) as any;
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

