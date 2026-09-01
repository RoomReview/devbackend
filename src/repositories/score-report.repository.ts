import {
  ScoreReportCreateInput,
  ScoreReportSelect,
  ScoreReportUpdateInput,
} from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'ScoreReportRepository',
  function: '',
};

export const createScoreReport = async (
  scoreReport: ScoreReportCreateInput,
  tx = prisma,
) => {
  return await tx.scoreReport.create({ data: scoreReport }).catch((err: unknown) => {
    logContext.function = 'createScoreReport';
    logger.error(logContext, 'Error in createScoreReport repository', { error: err });
    throw new Error('DB: score report create operation failed');
  });
};

export const findScoreReportById = async (
  scoreReportId: string,
  select?: ScoreReportSelect,
) => {
  return await prisma.scoreReport.findUnique({
    where: { scoreReportId },
    select: select || {
      scoreReportId: true,
      boroughId: true,
      postcodeId: true,
      name: true,
      description: true,
      status: true,
      overallScore: true,
      boroughScore: true,
      postcodeScore: true,
      scoreBreakdown: true,
      reportData: true,
      failureReason: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch((err: unknown) => {
    logContext.function = 'findScoreReportById';
    logger.error(logContext, 'Error in findScoreReportById repository', { error: err });
    throw new Error('DB: find score report operation failed');
  });
};

export const updateScoreReport = async (
  scoreReportId: string,
  data: ScoreReportUpdateInput,
  tx = prisma,
) => {
  return await tx.scoreReport.update({
    where: { scoreReportId },
    data,
  }).catch((err: unknown) => {
    logContext.function = 'updateScoreReport';
    logger.error(logContext, 'Error in updateScoreReport repository', { error: err });
    throw new Error('DB: score report update operation failed');
  });
};

export const deleteScoreReport = async (
  scoreReportId: string,
  tx = prisma,
) => {
  return await tx.scoreReport.delete({
    where: { scoreReportId },
  }).catch((err: unknown) => {
    logContext.function = 'deleteScoreReport';
    logger.error(logContext, 'Error in deleteScoreReport repository', { error: err });
    throw new Error('DB: score report delete operation failed');
  });
};

