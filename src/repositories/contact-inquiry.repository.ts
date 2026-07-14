import { ContactInquirySelect, ContactInquiryCreateInput, ContactInquiryUpdateInput } from '@/generated/prisma/models';
import { InquiryStatus } from '@/generated/prisma/enums';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'ContactInquiryRepository',
  function: '',
};

export const createInquiry = async (
  inquiry: ContactInquiryCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.contactInquiry.create({ data: inquiry }).catch(err => {
    logContext.function = 'createInquiry';
    logger.error(logContext, 'Error in createInquiry repository', { error: err });
    throw new Error('DB: contact inquiry create operation failed');
  });
};

export const findInquiryById = async (contactInquiryId: string, select?: ContactInquirySelect) => {
  return await prisma.contactInquiry.findUnique({
    where: { contactInquiryId },
    select: select || {
      contactInquiryId: true,
      name: true,
      email: true,
      subject: true,
      message: true,
      status: true,
      adminNotes: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findInquiryById';
    logger.error(logContext, 'Error in findInquiryById repository', { error: err });
    throw new Error('DB: findInquiryById operation failed');
  });
};

export const findAllInquiries = async (
  limit: number,
  offset: number,
  status?: InquiryStatus,
  select?: ContactInquirySelect,
) => {
  const where: any = {};
  if (status) where.status = status;

  return await prisma.contactInquiry.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: select || {
      contactInquiryId: true,
      name: true,
      email: true,
      subject: true,
      status: true,
      createdAt: true,
    },
  }).catch(err => {
    logContext.function = 'findAllInquiries';
    logger.error(logContext, 'Error in findAllInquiries repository', { error: err });
    throw new Error('DB: findAllInquiries operation failed');
  });
};

export const countInquiries = async (status?: InquiryStatus) => {
  const where: any = {};
  if (status) where.status = status;

  return await prisma.contactInquiry.count({ where }).catch(err => {
    logContext.function = 'countInquiries';
    logger.error(logContext, 'Error in countInquiries repository', { error: err });
    throw new Error('DB: countInquiries operation failed');
  });
};

export const updateInquiry = async (
  contactInquiryId: string,
  data: ContactInquiryUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.contactInquiry.update({
    where: { contactInquiryId },
    data,
  }).catch(err => {
    logContext.function = 'updateInquiry';
    logger.error(logContext, 'Error in updateInquiry repository', { error: err });
    throw new Error('DB: contact inquiry update operation failed');
  });
};

export const deleteInquiry = async (
  contactInquiryId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.contactInquiry.delete({
    where: { contactInquiryId },
  }).catch(err => {
    logContext.function = 'deleteInquiry';
    logger.error(logContext, 'Error in deleteInquiry repository', { error: err });
    throw new Error('DB: contact inquiry delete operation failed');
  });
};
