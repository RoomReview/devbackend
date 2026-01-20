import { Request, Response, NextFunction } from 'express';

export const validateRequest = (schema: {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // TODO: Implement schema validation (e.g., with Zod or Joi)
    if (schema.body && !req.body) {
      res.status(400).json({ error: 'Request body is required' });
      return;
    }

    next();
  };
};
