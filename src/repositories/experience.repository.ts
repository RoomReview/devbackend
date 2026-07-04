import { ExperienceSelect, ExperienceCreateInput, ExperienceUpdateInput } from '@/generated/prisma/models';
import { ExperienceType, ExperienceStatus } from '@/generated/prisma/enums';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'ExperienceRepository',
  function: '',
};

export const createExperience = async (
  experience: ExperienceCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.experience.create({ data: experience }).catch(err => {
    logContext.function = 'createExperience';
    logger.error(logContext, 'Error in createExperience repository', { error: err });
    throw new Error('DB: experience create operation failed');
  });
};

export const findExperienceById = async (experienceId: string, select?: ExperienceSelect) => {
  return await prisma.experience.findUnique({
    where: { experienceId },
    select: select || {
      experienceId: true,
      type: true,
      title: true,
      story: true,
      landlordName: true,
      agentName: true,
      yearOfExperience: true,
      anonymous: true,
      contactEmail: true,
      status: true,
      adminNotes: true,
      authorId: true,
      postcodeId: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findExperienceById';
    logger.error(logContext, 'Error in findExperienceById repository', { error: err });
    throw new Error('DB: findExperienceById operation failed');
  });
};

export interface FindExperiencesFilter {
  type?: ExperienceType;
  status?: ExperienceStatus;
  postcodeId?: string;
  authorId?: string;
}

export const findAllExperiences = async (
  limit: number,
  offset: number,
  filter?: FindExperiencesFilter,
  select?: ExperienceSelect,
) => {
  const where: any = {};
  if (filter?.type) where.type = filter.type;
  if (filter?.status) where.status = filter.status;
  if (filter?.postcodeId) where.postcodeId = filter.postcodeId;
  if (filter?.authorId) where.authorId = filter.authorId;

  return await prisma.experience.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: select || {
      experienceId: true,
      type: true,
      title: true,
      story: true,
      anonymous: true,
      status: true,
      postcodeId: true,
      createdAt: true,
    },
  }).catch(err => {
    logContext.function = 'findAllExperiences';
    logger.error(logContext, 'Error in findAllExperiences repository', { error: err });
    throw new Error('DB: findAllExperiences operation failed');
  });
};

export const countExperiences = async (filter?: FindExperiencesFilter) => {
  const where: any = {};
  if (filter?.type) where.type = filter.type;
  if (filter?.status) where.status = filter.status;
  if (filter?.postcodeId) where.postcodeId = filter.postcodeId;
  if (filter?.authorId) where.authorId = filter.authorId;

  return await prisma.experience.count({ where }).catch(err => {
    logContext.function = 'countExperiences';
    logger.error(logContext, 'Error in countExperiences repository', { error: err });
    throw new Error('DB: countExperiences operation failed');
  });
};

export const updateExperience = async (
  experienceId: string,
  data: ExperienceUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.experience.update({
    where: { experienceId },
    data,
  }).catch(err => {
    logContext.function = 'updateExperience';
    logger.error(logContext, 'Error in updateExperience repository', { error: err });
    throw new Error('DB: experience update operation failed');
  });
};

export const deleteExperience = async (
  experienceId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.experience.delete({
    where: { experienceId },
  }).catch(err => {
    logContext.function = 'deleteExperience';
    logger.error(logContext, 'Error in deleteExperience repository', { error: err });
    throw new Error('DB: experience delete operation failed');
  });
};
