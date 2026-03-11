// @ts-check

import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const defaultGenerator = (_req: Request) => {
  return randomUUID();
};

export const assignRequestId = ({
  generator = defaultGenerator,
  headerName = 'X-Request-ID',
  setHeader = true,
} = {}) => {
  return function (req: Request, res: Response, next: NextFunction) {
    const requestId = req.header(headerName) ?? generator(req);
    (req as any)['id'] = requestId;
    if (setHeader) {
      res.setHeader(headerName, requestId);
    }
    next();
  };
};
