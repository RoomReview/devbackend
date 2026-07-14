import { NewsletterSubscriberSelect, NewsletterSubscriberCreateInput, NewsletterSubscriberUpdateInput } from '@/generated/prisma/models';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'NewsletterRepository',
  function: '',
};

export const createSubscriber = async (
  subscriber: NewsletterSubscriberCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.newsletterSubscriber.create({ data: subscriber }).catch(err => {
    logContext.function = 'createSubscriber';
    logger.error(logContext, 'Error in createSubscriber repository', { error: err });
    throw new Error('DB: newsletter subscriber create operation failed');
  });
};

export const findSubscriberByEmail = async (email: string, select?: NewsletterSubscriberSelect) => {
  return await prisma.newsletterSubscriber.findUnique({
    where: { email },
    select: select || {
      newsletterSubscriberId: true,
      email: true,
      confirmed: true,
      confirmToken: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findSubscriberByEmail';
    logger.error(logContext, 'Error in findSubscriberByEmail repository', { error: err });
    throw new Error('DB: findSubscriberByEmail operation failed');
  });
};

export const findSubscriberByToken = async (confirmToken: string, select?: NewsletterSubscriberSelect) => {
  return await prisma.newsletterSubscriber.findFirst({
    where: { confirmToken },
    select: select || {
      newsletterSubscriberId: true,
      email: true,
      confirmed: true,
      confirmToken: true,
      createdAt: true,
      updatedAt: true,
    },
  }).catch(err => {
    logContext.function = 'findSubscriberByToken';
    logger.error(logContext, 'Error in findSubscriberByToken repository', { error: err });
    throw new Error('DB: findSubscriberByToken operation failed');
  });
};

export const findAllSubscribers = async (
  limit: number,
  offset: number,
  select?: NewsletterSubscriberSelect,
) => {
  return await prisma.newsletterSubscriber.findMany({
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: select || {
      newsletterSubscriberId: true,
      email: true,
      confirmed: true,
      createdAt: true,
    },
  }).catch(err => {
    logContext.function = 'findAllSubscribers';
    logger.error(logContext, 'Error in findAllSubscribers repository', { error: err });
    throw new Error('DB: findAllSubscribers operation failed');
  });
};

export const countSubscribers = async () => {
  return await prisma.newsletterSubscriber.count().catch(err => {
    logContext.function = 'countSubscribers';
    logger.error(logContext, 'Error in countSubscribers repository', { error: err });
    throw new Error('DB: countSubscribers operation failed');
  });
};

export const updateSubscriber = async (
  newsletterSubscriberId: string,
  data: NewsletterSubscriberUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.newsletterSubscriber.update({
    where: { newsletterSubscriberId },
    data,
  }).catch(err => {
    logContext.function = 'updateSubscriber';
    logger.error(logContext, 'Error in updateSubscriber repository', { error: err });
    throw new Error('DB: newsletter subscriber update operation failed');
  });
};

export const deleteSubscriberByEmail = async (
  email: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.newsletterSubscriber.delete({
    where: { email },
  }).catch(err => {
    logContext.function = 'deleteSubscriberByEmail';
    logger.error(logContext, 'Error in deleteSubscriberByEmail repository', { error: err });
    throw new Error('DB: newsletter subscriber delete operation failed');
  });
};
