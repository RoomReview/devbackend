import { permissions } from '@/config/permissions';
import { validateAccessToken } from '@/services/auth.service';
import type { AuthenticatedRequest } from '@/types';
import { UnauthorizedError } from '@/utils/custom-error';
import type { NextFunction, Request, Response } from 'express';
import { verifyRefreshToken } from '@/utils/jwt.token';

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

  req.user = { userId: user.userId, email: user.email, role: user.role, accessTokenId: session?.accessTokenId ?? '' };

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

/**
 * Middleware for the refresh endpoint.
 * Decodes the refresh token from req.body and confirms its `sub` claim
 * matches req.body.userId. Must run after validateRequest so the body
 * is already parsed and typed.
 */
export const requireBodyUserMatch = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const { userId, refreshToken } = req.body as { userId: string; refreshToken: string };

  const decoded = verifyRefreshToken(refreshToken);

  if (decoded.sub !== userId) {
    throw new UnauthorizedError({ message: 'Token does not match the provided userId' });
  }

  next();
};
