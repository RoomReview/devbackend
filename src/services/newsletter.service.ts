import {
  createSubscriber,
  findSubscriberByEmail,
  findSubscriberByToken,
  findAllSubscribers,
  countSubscribers,
  updateSubscriber,
  deleteSubscriberByEmail,
} from '@/repositories/newsletter.repository';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import type { SubscribeNewsletterDto, ConfirmNewsletterDto } from '@/dto/newsletter.dto';
import { paginate } from '@/utils/helpers';
import { randomUUID } from 'node:crypto';

export const subscribeToNewsletter = async (data: SubscribeNewsletterDto) => {
  const existing = await findSubscriberByEmail(data.email);
  const confirmToken = randomUUID();

  if (existing) {
    if (existing.confirmed) {
      throw new ValidationError({
        message: 'Email is already subscribed',
        code: 'VALIDATION_ERROR',
      });
    }
    
    // Resend/update confirmation token
    return await updateSubscriber(existing.newsletterSubscriberId, {
      confirmToken,
    });
  }

  return await createSubscriber({
    email: data.email,
    confirmToken,
    confirmed: false,
  });
};

export const confirmSubscription = async (data: ConfirmNewsletterDto) => {
  const subscriber = await findSubscriberByToken(data.confirmToken);
  if (!subscriber) {
    throw new ValidationError({
      message: 'Invalid or expired confirmation token',
      code: 'VALIDATION_ERROR',
    });
  }

  return await updateSubscriber(subscriber.newsletterSubscriberId, {
    confirmed: true,
    confirmToken: null,
  });
};

export const unsubscribeFromNewsletter = async (email: string) => {
  const subscriber = await findSubscriberByEmail(email);
  if (!subscriber) {
    throw new EntityNotFoundError({
      message: `Subscriber with email ${email} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  return await deleteSubscriberByEmail(email);
};

export const getAllSubscribers = async (page: number, limit: number) => {
  const { offset } = paginate(page, limit);
  const items = await findAllSubscribers(limit, offset);
  const total = await countSubscribers();
  const totalPages = Math.ceil(total / limit);

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};
