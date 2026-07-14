import { LocalPlanSelect, LocalPlanCreateInput, LocalPlanUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'LocalPlanRepository',
  function: '',
};

export const createLocalPlan = async (
  plan: LocalPlanCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.localPlan.create({ data: plan }).catch(err => {
    logContext.function = 'createLocalPlan';
    logger.error(logContext, 'Error in createLocalPlan repository', { error: err });
    throw new Error('DB: local plan create operation failed');
  });
};

export const findLocalPlanById = async (localPlanId: string, select?: LocalPlanSelect) => {
  return await prisma.localPlan.findUnique({
    where: { localPlanId },
    select: select || {
      localPlanId: true,
      borough: true,
      title: true,
      documentUrl: true,
      adoptionDate: true,
      status: true,
      category: true,
      summary: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findLocalPlanById';
    logger.error(logContext, 'Error in findLocalPlanById repository', { error: err });
    throw new Error('DB: findLocalPlanById operation failed');
  });
};

export interface FindLocalPlansFilter {
  borough?: string;
  category?: string;
  status?: string;
}

export const findAllLocalPlans = async (
  limit: number,
  offset: number,
  filter?: FindLocalPlansFilter,
  select?: LocalPlanSelect,
) => {
  const where: any = {};
  if (filter?.borough) where.borough = filter.borough;
  if (filter?.category) where.category = filter.category;
  if (filter?.status) where.status = filter.status;

  return await prisma.localPlan.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { adoptionDate: 'desc' },
    select: select || {
      localPlanId: true,
      borough: true,
      title: true,
      documentUrl: true,
      adoptionDate: true,
      status: true,
      category: true,
    },
  }).catch(err => {
    logContext.function = 'findAllLocalPlans';
    logger.error(logContext, 'Error in findAllLocalPlans repository', { error: err });
    throw new Error('DB: findAllLocalPlans operation failed');
  });
};

export const countLocalPlans = async (filter?: FindLocalPlansFilter) => {
  const where: any = {};
  if (filter?.borough) where.borough = filter.borough;
  if (filter?.category) where.category = filter.category;
  if (filter?.status) where.status = filter.status;

  return await prisma.localPlan.count({ where }).catch(err => {
    logContext.function = 'countLocalPlans';
    logger.error(logContext, 'Error in countLocalPlans repository', { error: err });
    throw new Error('DB: countLocalPlans operation failed');
  });
};

export const updateLocalPlan = async (
  localPlanId: string,
  data: LocalPlanUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.localPlan.update({
    where: { localPlanId },
    data,
  }).catch(err => {
    logContext.function = 'updateLocalPlan';
    logger.error(logContext, 'Error in updateLocalPlan repository', { error: err });
    throw new Error('DB: local plan update operation failed');
  });
};

export const deleteLocalPlan = async (
  localPlanId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.localPlan.delete({
    where: { localPlanId },
  }).catch(err => {
    logContext.function = 'deleteLocalPlan';
    logger.error(logContext, 'Error in deleteLocalPlan repository', { error: err });
    throw new Error('DB: local plan delete operation failed');
  });
};
