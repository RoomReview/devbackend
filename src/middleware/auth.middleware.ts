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

  const { user, session } = await validateAccessToken(token);

  req.user = {
    userId: user.userId,
    email: user.email,
    role: user.role,
    accessTokenId: session?.accessTokenId ?? '',
  };

  next();
};

export const authorize = (...pems: (keyof typeof permissions)[]) => {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): void => {
    const { user } = req;
    const { userId, role } = user || {};
    if (!user && !userId && !role) {
      throw new UnauthorizedError({ message: 'No user authenticated' });
    }

    const isAllowed = pems.some((each) =>
      permissions[each].includes(role as any),
    );
    if (!isAllowed) {
      throw new UnauthorizedError({ message: 'Insufficient permissions' });
    }

    next();
  };
};

/**
 * Middleware to ensure the authenticated user ID matches the requested user ID.
 * It searches the request object sequentially using the provided keys
 * (e.g., ['params.userId', 'body.userId', 'query.userId']).
 */
export const requireMatchingUser = (keys: string[]) => {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user?.userId) {
      throw new UnauthorizedError({ message: 'User authorization required' });
    }

    const { userId: authenticatedUserId } = req.user;
    let requestUserId: string | undefined;

    for (const key of keys) {
      const parts = key.split('.');
      let current: any = req;
      for (const part of parts) {
        if (current === undefined || current === null) {break;}
        current = current[part];
      }
      if (typeof current === 'string') {
        requestUserId = current;
        break;
      }
    }

    if (!requestUserId) {
      throw new UnauthorizedError({
        message: 'No userId found in request using provided keys',
      });
    }

    if (authenticatedUserId !== requestUserId) {
      throw new UnauthorizedError({
        message: 'Authenticated user does not match the requested userId',
      });
    }

    next();
  };
};
