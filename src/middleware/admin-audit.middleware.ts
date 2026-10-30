import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/types';
import prisma from '@config/database';
import logger from '@/utils/logger';

export const auditAdminAction = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const actor = req.user;
  if (!actor?.userId || actor.role !== 'ADMIN') {
    next();
    return;
  }

  const routePath = `${req.baseUrl}${req.route?.path ?? req.path}`;
  const resource = routePath.replace(/^\/api\/v\d+\//, '').split('/')[0] ?? 'admin';
  const requestedResourceId = req.params.userId
    ?? req.params.reviewId
    ?? req.params.id;
  const resourceId = Array.isArray(requestedResourceId)
    ? requestedResourceId[0] ?? null
    : requestedResourceId ?? null;
  const details: Record<string, string | boolean> = {};
  if (req.body?.status === 'APPROVED' || req.body?.status === 'REJECTED') {
    details.reviewStatus = req.body.status;
  }
  if (typeof req.body?.isActive === 'boolean') {
    details.isActive = req.body.isActive;
  }

  try {
    const auditLog = await prisma.adminAuditLog.create({
      data: {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: `${req.method} ${routePath}`,
        resource,
        resourceId,
        ...(Object.keys(details).length > 0 ? { details } : {}),
        method: req.method,
        path: routePath,
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
      },
      select: { auditLogId: true },
    });

    res.once('finish', () => {
      void prisma.adminAuditLog.update({
        where: { auditLogId: auditLog.auditLogId },
        data: { statusCode: res.statusCode },
      }).catch((error: unknown) => {
        logger.error(
          { service: 'AdminAudit', function: 'recordResponseStatus' },
          'Failed to record admin action response status',
          { auditLogId: auditLog.auditLogId, error },
        );
      });
    });
    next();
  } catch (error) {
    logger.error(
      { service: 'AdminAudit', function: 'recordAction' },
      'Failed to record admin action; request blocked',
      { actorUserId: actor.userId, method: req.method, path: routePath, error },
    );
    next(error);
  }
};
