import {
  SessionCreateInput,
  SessionModel,
} from '@/generated/prisma/models';
import prisma from '@config/database';

export const fetchSessionByUserId = async (userId: string) => {
  return await prisma.session.findFirst({ where: { userId } });
};

export const createSession = async (data: SessionCreateInput) => {
  return await prisma.session.create({ data });
};

export const deleteSessionsByUserId = async (userId: string) => {
  return await prisma.session.deleteMany({ where: { userId } });
};

export const updateSessionAccessTokenId = async (
  data: Pick<
    SessionModel,
    | 'sessionId'
    | 'accessTokenId'
    | 'accessTokenExpiry'
  >,
) => {
  const {
    sessionId,
    accessTokenId,
    accessTokenExpiry,
  } = data;
  return await prisma.session.update({
    where: { sessionId },
    data: { accessTokenId, accessTokenExpiry },
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
  });
};

export const upsertSession = async (data: Omit<SessionModel, 'sessionId' | 'updatedAt' | 'createdAt'>) => {
  const { userId, accessTokenId, accessTokenExpiry, refreshTokenId, refreshTokenExpiry } = data;
  return await prisma.session.upsert({
    where: { userId: userId },
    update: {
      accessTokenId: accessTokenId,
      accessTokenExpiry: accessTokenExpiry,
      refreshTokenId: refreshTokenId,
      refreshTokenExpiry: refreshTokenExpiry,
    },
    create: {
      userId: userId,
      accessTokenId: accessTokenId,
      accessTokenExpiry: accessTokenExpiry,
      refreshTokenId: refreshTokenId,
      refreshTokenExpiry: refreshTokenExpiry,
    },
    select: {
      sessionId: true,
      userId: true,
    },
  });
};
/**
 * find user session by userId & access token id
 */
export const findUserSessionByAccessTokenId = async (accessTokenId: string, userId: string) => {
  return await prisma.session.findFirst({ where: { accessTokenId, userId } });
};
