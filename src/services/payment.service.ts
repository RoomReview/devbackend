import { createHmac, timingSafeEqual } from 'node:crypto';
import config from '@config/index';
import { findReportOrderForReport, createReportOrder, setStripeSession, markOrderPaid, markOrderCancelled, listReportOrders } from '@/repositories/report-order.repository';
import { findScoreReportOwner } from '@/repositories/score-report.repository';
import {
  findBillingSubscriptionByStripeId,
  getBillingStatus,
  grantSubscriptionCredits,
  consumeReportCredit,
  saveBillingSubscription,
  updateBillingSubscription,
} from '@/repositories/billing.repository';
import { enqueueScoreReportGeneration } from '@/services/score-report.service';
import { EntityNotFoundError, InternalServerError, UnauthorizedError, ValidationError } from '@/utils/custom-error';

type StripeCheckoutSession = {
  id: string;
  url: string | null;
  mode?: string;
  customer?: string | null;
  subscription?: string | null;
  payment_intent?: string | null;
  metadata?: Record<string, string>;
};

type StripeSubscription = {
  id: string;
  status: string;
  customer?: string | null;
  metadata?: Record<string, string>;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
};

type StripeInvoice = {
  id: string;
  subscription?: string | null;
  parent?: {
    subscription_details?: {
      subscription?: string | null;
    } | null;
  } | null;
};

const toDate = (value?: number) => value ? new Date(value * 1000) : null;
const mapSubscriptionStatus = (status: string) => {
  if (status === 'active') return 'ACTIVE' as const;
  if (status === 'past_due') return 'PAST_DUE' as const;
  if (status === 'canceled') return 'CANCELED' as const;
  if (status === 'unpaid') return 'UNPAID' as const;
  return 'INCOMPLETE' as const;
};

const stripeRequest = async (path: string, body: URLSearchParams) => {
  if (!config.stripeSecretKey) {
    throw new InternalServerError({ message: 'Stripe is not configured', code: 'INTERNAL_SERVER_ERROR' });
  }
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await response.json() as StripeCheckoutSession & { error?: { message?: string } };
  if (!response.ok) {
    throw new InternalServerError({ message: data.error?.message ?? 'Stripe request failed', code: 'INTERNAL_SERVER_ERROR' });
  }
  return data;
};

const stripeGet = async <T>(path: string): Promise<T> => {
  if (!config.stripeSecretKey) {
    throw new InternalServerError({ message: 'Stripe is not configured', code: 'INTERNAL_SERVER_ERROR' });
  }
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${config.stripeSecretKey}` },
  });
  const data = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new InternalServerError({ message: data.error?.message ?? 'Stripe request failed', code: 'INTERNAL_SERVER_ERROR' });
  }
  return data;
};

export const createCheckout = async (scoreReportId: string, userId: string) => {
  const owner = await findScoreReportOwner(scoreReportId);
  if (!owner) throw new EntityNotFoundError({ message: 'Score report not found', code: 'ENTITY_NOT_FOUND' });
  if (owner !== userId) throw new UnauthorizedError({ message: 'You do not own this report' });

  const existing = await findReportOrderForReport(scoreReportId, userId);
  if (existing?.status === 'PAID') return { order: existing, checkoutUrl: null };

  const order = existing ?? await createReportOrder(userId, scoreReportId, config.stripeReportAmount, config.stripeCurrency);
  if (!order) throw new InternalServerError({ message: 'Unable to create report order', code: 'INTERNAL_SERVER_ERROR' });

  const form = new URLSearchParams({
    mode: 'payment',
    success_url: config.stripeSuccessUrl,
    cancel_url: config.stripeCancelUrl,
    customer_creation: 'always',
    'line_items[0][quantity]': '1',
    'metadata[orderId]': order.orderId,
    'metadata[reportId]': scoreReportId,
    'metadata[userId]': userId,
  });
  if (config.stripeReportPriceId) {
    form.set('line_items[0][price]', config.stripeReportPriceId);
  } else {
    form.set('line_items[0][price_data][currency]', config.stripeCurrency);
    form.set('line_items[0][price_data][unit_amount]', String(config.stripeReportAmount));
    form.set('line_items[0][price_data][product_data][name]', 'RoomReview property report');
  }

  const session = await stripeRequest('checkout/sessions', form);
  await setStripeSession(order.orderId, session.id);
  return { order: { ...order, stripeSessionId: session.id }, checkoutUrl: session.url };
};

export const createSubscriptionCheckout = async (userId: string) => {
  const billing = await getBillingStatus(userId);
  if (billing.trialActive) {
    throw new ValidationError({ message: 'Your free trial is still active', code: 'VALIDATION_ERROR' });
  }
  if (billing.subscription?.status === 'ACTIVE') {
    return { checkoutUrl: null, subscription: billing.subscription };
  }

  const form = new URLSearchParams({
    mode: 'subscription',
    success_url: config.stripeSuccessUrl,
    cancel_url: config.stripeCancelUrl,
    'line_items[0][quantity]': '1',
    'subscription_data[metadata][userId]': userId,
    'subscription_data[metadata][credits]': String(config.stripeSubscriptionCredits),
    'metadata[userId]': userId,
  });
  if (config.stripeSubscriptionPriceId) {
    form.set('line_items[0][price]', config.stripeSubscriptionPriceId);
  } else {
    form.set('line_items[0][price_data][currency]', config.stripeCurrency);
    form.set('line_items[0][price_data][unit_amount]', String(config.stripeSubscriptionAmount));
    form.set('line_items[0][price_data][recurring][interval]', 'month');
    form.set('line_items[0][price_data][product_data][name]', 'RoomReview - 10 reports per month');
  }
  const session = await stripeRequest('checkout/sessions', form);
  return { checkoutUrl: session.url, subscription: null };
};

const verifyWebhook = (payload: Buffer, signature: string) => {
  if (!config.stripeWebhookSecret) throw new UnauthorizedError({ message: 'Stripe webhook is not configured' });
  const parts = Object.fromEntries(signature.split(',').map((part) => part.split('=')));
  const timestamp = parts.t;
  const received = parts.v1;
  if (!timestamp || !received || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new UnauthorizedError({ message: 'Invalid Stripe webhook signature' });
  }
  const expected = createHmac('sha256', config.stripeWebhookSecret).update(`${timestamp}.${payload.toString('utf8')}`).digest('hex');
  if (received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    throw new UnauthorizedError({ message: 'Invalid Stripe webhook signature' });
  }
  return JSON.parse(payload.toString('utf8')) as { id: string; type: string; data: { object: StripeCheckoutSession } };
};

export const handleWebhook = async (payload: Buffer, signature: string) => {
  const event = verifyWebhook(payload, signature);
  if (event.type === 'checkout.session.expired') {
    await markOrderCancelled(event.data.object.id);
    return { handled: true };
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as unknown as StripeSubscription;
    await updateBillingSubscription(subscription.id, {
      status: mapSubscriptionStatus(subscription.status),
      currentPeriodEnd: toDate(subscription.current_period_end),
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    });
    return { handled: true };
  }
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as unknown as StripeInvoice;
    const subscriptionId = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
    if (!subscriptionId) return { handled: false };
    let subscription = await findBillingSubscriptionByStripeId(subscriptionId);
    if (!subscription) {
      const stripeSubscription = await stripeGet<StripeSubscription>(`subscriptions/${subscriptionId}`);
      const userId = stripeSubscription.metadata?.userId;
      if (!userId) return { handled: false };
      subscription = await saveBillingSubscription({
        userId,
        stripeCustomerId: stripeSubscription.customer ?? null,
        stripeSubscriptionId: stripeSubscription.id,
        status: mapSubscriptionStatus(stripeSubscription.status),
        currentPeriodEnd: toDate(stripeSubscription.current_period_end),
        cancelAtPeriodEnd: Boolean(stripeSubscription.cancel_at_period_end),
      });
    }
    const granted = await grantSubscriptionCredits({
      userId: subscription.userId,
      eventId: event.id,
      invoiceId: invoice.id,
      credits: config.stripeSubscriptionCredits,
    });
    return { handled: granted };
  }
  if (event.type !== 'checkout.session.completed') return { handled: false };
  const session = event.data.object;
  if (session.mode === 'subscription' && session.subscription && session.metadata?.userId) {
    await saveBillingSubscription({
      userId: session.metadata.userId,
      stripeCustomerId: session.customer ?? null,
      stripeSubscriptionId: session.subscription,
      status: 'ACTIVE',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    return { handled: true };
  }
  const order = await markOrderPaid(session.id, session.payment_intent ?? null);
  if (order) await enqueueScoreReportGeneration(order.scoreReportId);
  return { handled: Boolean(order) };
};

export const getOrderHistory = (userId: string) => listReportOrders(userId);
export const getBilling = (userId: string) => getBillingStatus(userId);

export const assertReportOwner = async (scoreReportId: string, userId: string) => {
  const owner = await findScoreReportOwner(scoreReportId);
  if (!owner) throw new EntityNotFoundError({ message: 'Score report not found', code: 'ENTITY_NOT_FOUND' });
  if (owner !== userId) throw new UnauthorizedError({ message: 'You do not own this report' });
};

export const assertPaidReportAccess = async (scoreReportId: string, userId: string) => {
  await assertReportOwner(scoreReportId, userId);
  const order = await findReportOrderForReport(scoreReportId, userId);
  if (order?.status === 'PAID') return order;
  if (await consumeReportCredit(userId, scoreReportId)) {
    return { status: 'PAID' as const, scoreReportId, userId };
  }
  throw new UnauthorizedError({ message: 'A paid order or available report credit is required to access this report' });
};