import { DownloadHistorySelect, DownloadHistoryCreateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'DownloadHistoryRepository',
  function: '',
};

export const createDownloadHistory = async (
  download: DownloadHistoryCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.downloadHistory.create({ data: download }).catch(err => {
    logContext.function = 'createDownloadHistory';
    logger.error(logContext, 'Error in createDownloadHistory repository', { error: err });
    throw new Error('DB: download history create operation failed');
  });
};

export const findDownloadHistoryById = async (downloadHistoryId: string, select?: DownloadHistorySelect) => {
  return await prisma.downloadHistory.findUnique({
    where: { downloadHistoryId },
    select: select || {
      downloadHistoryId: true,
      userCreditsId: true,
      reportType: true,
      format: true,
      postcode: true,
      borough: true,
      creditsUsed: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findDownloadHistoryById';
    logger.error(logContext, 'Error in findDownloadHistoryById repository', { error: err });
    throw new Error('DB: findDownloadHistoryById operation failed');
  });
};

export const findAllDownloadHistoryByUserCreditsId = async (
  userCreditsId: string,
  limit: number,
  offset: number,
  select?: DownloadHistorySelect,
) => {
  return await prisma.downloadHistory.findMany({
    where: { userCreditsId },
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: select || {
      downloadHistoryId: true,
      reportType: true,
      format: true,
      postcode: true,
      borough: true,
      creditsUsed: true,
      createdAt: true,
    },
  }).catch(err => {
    logContext.function = 'findAllDownloadHistoryByUserCreditsId';
    logger.error(logContext, 'Error in findAllDownloadHistoryByUserCreditsId repository', { error: err });
    throw new Error('DB: findAllDownloadHistoryByUserCreditsId operation failed');
  });
};

export const countDownloadHistoryByUserCreditsId = async (userCreditsId: string) => {
  return await prisma.downloadHistory.count({ where: { userCreditsId } }).catch(err => {
    logContext.function = 'countDownloadHistoryByUserCreditsId';
    logger.error(logContext, 'Error in countDownloadHistoryByUserCreditsId repository', { error: err });
    throw new Error('DB: countDownloadHistoryByUserCreditsId operation failed');
  });
};
