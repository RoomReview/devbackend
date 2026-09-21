import { SessionCreateInput, SessionModel } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'SessionRepository',
  function: '',
};


export const fetchSessionByUserId = async (userId: string) => {
  return await prisma.session.findFirst({ where: { userId } }).catch((err: unknown) => {
    logContext.function = 'fetchSessionByUserId';
    logger.error(logContext, 'Error in fetchSessionByUserId repository', { error: err });
    throw new Error('DB: fetchSessionByUserId operation failed');
  });
};

export const createSession = async (data: SessionCreateInput) => {
  return await prisma.session.create({ data }).catch((err: unknown) => {
    logContext.function = 'createSession';
    logger.error(logContext, 'Error in createSession repository', { error: err });
    throw new Error('DB: createSession operation failed');
  });
};

export const deleteSessionsByUserId = async (userId: string) => {
  return await prisma.session.deleteMany({ where: { userId } }).catch((err: unknown) => {
    logContext.function = 'deleteSessionsByUserId';
    logger.error(logContext, 'Error in deleteSessionsByUserId repository', { error: err });
    throw new Error('DB: deleteSessionsByUserId operation failed');
  });
};

export const updateSessionAccessTokenId = async (
  data: Pick<SessionModel, 'sessionId' | 'accessTokenId' | 'accessTokenExpiry'>,
) => {
  const { sessionId, accessTokenId, accessTokenExpiry } = data;
  return await prisma.session.update({
    where: { sessionId },
    data: { accessTokenId, accessTokenExpiry },
  }).catch((err: unknown) => {
    logContext.function = 'updateSessionAccessTokenId';
    logger.error(logContext, 'Error in updateSessionAccessTokenId repository', { error: err });
    throw new Error('DB: updateSessionAccessTokenId operation failed');
  });
};

export const logoutSessionByUserId = async (userId: string) => {
  return await prisma.session.update({
    where: { userId },
    data: {
      accessTokenId: null,
      accessTokenExpiry: null,
      refreshTokenId: null,
      refreshTokenExpiry: null,
    },
  }).catch((err: unknown) => {
    logContext.function = 'logoutSessionByUserId';
    logger.error(logContext, 'Error in logoutSessionByUserId repository', { error: err });
    throw new Error('DB: logoutSessionByUserId operation failed');
  });
};

export const upsertSession = async (
  data: Omit<SessionModel, 'sessionId' | 'updatedAt' | 'createdAt'>,
) => {
  const {
    userId,
    accessTokenId,
    accessTokenExpiry,
    refreshTokenId,
    refreshTokenExpiry,
  } = data;
  return await prisma.session.upsert({
    where: { userId },
    update: {
      accessTokenId,
      accessTokenExpiry,
      refreshTokenId,
      refreshTokenExpiry,
    },
    create: {
      userId,
      accessTokenId,
      accessTokenExpiry,
      refreshTokenId,
      refreshTokenExpiry,
    },
    select: {
      sessionId: true,
      userId: true,
    },
  }).catch((err: unknown) => {
    logContext.function = 'upsertSession';
    logger.error(logContext, 'Error in upsertSession repository', { error: err });
    throw new Error('DB: upsertSession operation failed');
  });
};
/**
 * find user session by userId & access token id
 */
export const findUserSessionByAccessTokenId = async (
  accessTokenId: string,
  userId: string,
) => {
  return await prisma.session.findFirst({ where: { accessTokenId, userId } }).catch((err: unknown) => {
    logContext.function = 'findUserSessionByAccessTokenId';
    logger.error(logContext, 'Error in findUserSessionByAccessTokenId repository', { error: err });
    throw new Error('DB: findUserSessionByAccessTokenId operation failed');
  });
};

/**
 * find user session by userId & refresh token id
 */
export const findUserSessionByRefreshTokenId = async (
  refreshTokenId: string,
  userId: string,
) => {
  return await prisma.session.findFirst({ where: { refreshTokenId, userId } }).catch((err: unknown) => {
    logContext.function = 'findUserSessionByRefreshTokenId';
    logger.error(logContext, 'Error in findUserSessionByRefreshTokenId repository', { error: err });
    throw new Error('DB: findUserSessionByRefreshTokenId operation failed');
  });
};
