import { AgencyCreateInput, UserAgencyUncheckedCreateInput } from '@/generated/prisma/models';
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
