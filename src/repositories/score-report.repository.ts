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

export const recoverScoreReportJobs = async () => {
  await prisma.$executeRaw`
    UPDATE score_reports
    SET status = 'WAITING', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'GENERATING'
      AND updated_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
  `;
};

export const claimNextScoreReportJob = async () => {
  const rows = await prisma.$queryRaw<Array<{ scoreReportId: string }>>`
    UPDATE score_reports
    SET status = 'GENERATING', updated_at = CURRENT_TIMESTAMP
    WHERE score_report_id = (
      SELECT score_report_id
      FROM score_reports
      WHERE status = 'WAITING'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING score_report_id AS "scoreReportId"
  `;
  return rows[0] ?? null;
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

export const assignScoreReportOwner = async (scoreReportId: string, userId: string) => {
  await prisma.$executeRaw`
    UPDATE score_reports SET user_id = ${userId}::uuid, updated_at = CURRENT_TIMESTAMP
    WHERE score_report_id = ${scoreReportId}
  `;
};

export const findScoreReportOwner = async (scoreReportId: string) => {
  const rows = await prisma.$queryRaw<Array<{ userId: string | null }>>`
    SELECT user_id AS "userId" FROM score_reports WHERE score_report_id = ${scoreReportId} LIMIT 1
  `;
  return rows[0]?.userId ?? null;
};
