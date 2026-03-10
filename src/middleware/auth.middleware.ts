import { permissions } from '@/config/permissions';
import { validateAccessToken } from '@/services/auth.service';
import type { AuthenticatedRequest } from '@/types';
import { UnauthorizedError } from '@/utils/custom-error';
import type { NextFunction, Response } from 'express';

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new UnauthorizedError({ message: 'No token provided' });
  }

  const { user } = await validateAccessToken(token);

  req.user = { userId: user.userId, email: user.email, role: user.role };

  next();
};

export const authorize = (...pems: (keyof typeof permissions)[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const { user } = req;
    const { userId, role } = user || {};
    if (!user && !userId && !role) {
      throw new UnauthorizedError({ message: 'No user authenticated' });
    }

    const isAllowed = pems.some(each => permissions[each].includes(role as any));
    if (!isAllowed) {
      throw new UnauthorizedError({ message: 'Insufficient permissions' });
    }

    next();
  };
};
