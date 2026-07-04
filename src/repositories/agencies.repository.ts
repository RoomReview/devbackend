import { AgencyCreateInput, UserAgencyUncheckedCreateInput, AgencySelect, AgencyUpdateInput } from '@/generated/prisma/models';
import prisma from '@config/database';
import logger, { LogContext } from '@/utils/logger';

const logContext: LogContext = {
  service: 'AgencyRepository',
  function: '',
};

export const createAgency = async (
  data: AgencyCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.agency.create({ data }).catch((err) => {
    logContext.function = 'createAgency';
    logger.error(logContext, 'Error in createAgency repository', { error: err });
    throw new Error('DB: agency create operation failed');
  });
};

export const createUserAgency = async (
  data: UserAgencyUncheckedCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.userAgency.create({ data }).catch((err) => {
    logContext.function = 'createUserAgency';
    logger.error(logContext, 'Error in createUserAgency repository', { error: err });
    throw new Error('DB: userAgency create operation failed');
  });
};

export const findAgencyByName = async (name: string) => {
  return await prisma.agency.findFirst({ where: { name } }).catch((err) => {
    logContext.function = 'findAgencyByName';
    logger.error(logContext, 'Error in findAgencyByName repository', { error: err });
    throw new Error('DB: findAgencyByName operation failed');
  });
};

export const findAgencyById = async (agencyId: string, select?: AgencySelect) => {
  return await prisma.agency.findUnique({
    where: { agencyId },
    select: select || {
      agencyId: true,
      name: true,
      description: true,
      email: true,
      phone: true,
      website: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch((err) => {
    logContext.function = 'findAgencyById';
    logger.error(logContext, 'Error in findAgencyById repository', { error: err });
    throw new Error('DB: findAgencyById operation failed');
  });
};

export const findAgencyByEmail = async (email: string) => {
  return await prisma.agency.findUnique({
    where: { email },
  }).catch((err) => {
    logContext.function = 'findAgencyByEmail';
    logger.error(logContext, 'Error in findAgencyByEmail repository', { error: err });
    throw new Error('DB: findAgencyByEmail operation failed');
  });
};

export const findAllAgencies = async (limit: number, offset: number, select?: AgencySelect) => {
  return await prisma.agency.findMany({
    take: limit,
    skip: offset,
    orderBy: { name: 'asc' },
    select: select || {
      agencyId: true,
      name: true,
      description: true,
      email: true,
      isVerified: true,
    },
  }).catch((err) => {
    logContext.function = 'findAllAgencies';
    logger.error(logContext, 'Error in findAllAgencies repository', { error: err });
    throw new Error('DB: findAllAgencies operation failed');
  });
};

export const countAgencies = async () => {
  return await prisma.agency.count().catch((err) => {
    logContext.function = 'countAgencies';
    logger.error(logContext, 'Error in countAgencies repository', { error: err });
    throw new Error('DB: countAgencies operation failed');
  });
};

export const updateAgency = async (
  agencyId: string,
  data: AgencyUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.agency.update({
    where: { agencyId },
    data,
  }).catch((err) => {
    logContext.function = 'updateAgency';
    logger.error(logContext, 'Error in updateAgency repository', { error: err });
    throw new Error('DB: agency update operation failed');
  });
};

export const deleteAgency = async (
  agencyId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.agency.delete({
    where: { agencyId },
  }).catch((err) => {
    logContext.function = 'deleteAgency';
    logger.error(logContext, 'Error in deleteAgency repository', { error: err });
    throw new Error('DB: agency delete operation failed');
  });
};

export const findUserAgenciesByAgencyId = async (agencyId: string) => {
  return await prisma.userAgency.findMany({
    where: { agencyId },
    include: {
      user: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
  }).catch((err) => {
    logContext.function = 'findUserAgenciesByAgencyId';
    logger.error(logContext, 'Error in findUserAgenciesByAgencyId repository', { error: err });
    throw new Error('DB: findUserAgenciesByAgencyId operation failed');
  });
};

export const findUserAgencyByUserAndAgency = async (userId: string, agencyId: string) => {
  return await prisma.userAgency.findUnique({
    where: {
      userId_agencyId: {
        userId,
        agencyId,
      },
    },
  }).catch((err) => {
    logContext.function = 'findUserAgencyByUserAndAgency';
    logger.error(logContext, 'Error in findUserAgencyByUserAndAgency repository', { error: err });
    throw new Error('DB: findUserAgencyByUserAndAgency operation failed');
  });
};

export const updateUserAgencyVerifyStatus = async (
  userId: string,
  agencyId: string,
  isVerified: boolean,
) => {
  return await prisma.userAgency.update({
    where: {
      userId_agencyId: {
        userId,
        agencyId,
      },
    },
    data: {
      isVerified,
    },
  }).catch((err) => {
    logContext.function = 'updateUserAgencyVerifyStatus';
    logger.error(logContext, 'Error in updateUserAgencyVerifyStatus repository', { error: err });
    throw new Error('DB: updateUserAgencyVerifyStatus operation failed');
  });
};
