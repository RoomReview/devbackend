import { randomUUID } from 'node:crypto';
import prisma from '@config/database';

export type ReportOrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export interface ReportOrderRow {
  orderId: string;
  userId: string;
  scoreReportId: string;
  stripeSessionId: string | null;
  stripePaymentIntent: string | null;
  amount: number;
  currency: string;
  status: ReportOrderStatus;
  paidAt: Date | null;
  createdAt: Date;
}

export const findReportOrder = async (orderId: string, userId?: string) => {
  const rows = userId
    ? await prisma.$queryRaw<ReportOrderRow[]>`
      SELECT order_id AS "orderId", user_id AS "userId", score_report_id AS "scoreReportId",
        stripe_session_id AS "stripeSessionId", stripe_payment_intent AS "stripePaymentIntent",
        amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
      FROM report_orders WHERE order_id = ${orderId}::uuid AND user_id = ${userId}::uuid LIMIT 1
    `
    : await prisma.$queryRaw<ReportOrderRow[]>`
      SELECT order_id AS "orderId", user_id AS "userId", score_report_id AS "scoreReportId",
        stripe_session_id AS "stripeSessionId", stripe_payment_intent AS "stripePaymentIntent",
        amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
      FROM report_orders WHERE order_id = ${orderId}::uuid LIMIT 1
    `;
  return rows[0] ?? null;
};

export const findReportOrderForReport = async (scoreReportId: string, userId: string) => {
  const rows = await prisma.$queryRaw<ReportOrderRow[]>`
    SELECT order_id AS "orderId", user_id AS "userId", score_report_id AS "scoreReportId",
      stripe_session_id AS "stripeSessionId", stripe_payment_intent AS "stripePaymentIntent",
      amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
    FROM report_orders
    WHERE score_report_id = ${scoreReportId} AND user_id = ${userId}::uuid
    ORDER BY created_at DESC LIMIT 1
  `;
  return rows[0] ?? null;
};

export const findReportOrderBySession = async (sessionId: string, userId: string) => {
  const rows = await prisma.$queryRaw<ReportOrderRow[]>`
    SELECT order_id AS "orderId", user_id AS "userId", score_report_id AS "scoreReportId",
      stripe_session_id AS "stripeSessionId", stripe_payment_intent AS "stripePaymentIntent",
      amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
    FROM report_orders
    WHERE stripe_session_id = ${sessionId} AND user_id = ${userId}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
};

export const createReportOrder = async (userId: string, scoreReportId: string, amount: number, currency: string) => {
  const orderId = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO report_orders (order_id, user_id, score_report_id, amount, currency)
    VALUES (${orderId}::uuid, ${userId}::uuid, ${scoreReportId}, ${amount}, ${currency})
  `;
  return findReportOrder(orderId, userId);
};

export const setStripeSession = async (orderId: string, sessionId: string) => {
  await prisma.$executeRaw`UPDATE report_orders SET stripe_session_id = ${sessionId}, updated_at = CURRENT_TIMESTAMP WHERE order_id = ${orderId}::uuid`;
};

export const markOrderPaid = async (sessionId: string, paymentIntent: string | null) => {
  await prisma.$executeRaw`
    UPDATE report_orders
    SET status = 'PAID', stripe_payment_intent = ${paymentIntent}, paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
    WHERE stripe_session_id = ${sessionId}
  `;
  const rows = await prisma.$queryRaw<ReportOrderRow[]>`
    SELECT order_id AS "orderId", user_id AS "userId", score_report_id AS "scoreReportId",
      stripe_session_id AS "stripeSessionId", stripe_payment_intent AS "stripePaymentIntent",
      amount, currency, status, paid_at AS "paidAt", created_at AS "createdAt"
    FROM report_orders WHERE stripe_session_id = ${sessionId} LIMIT 1
  `;
  return rows[0] ?? null;
};

export const markOrderFailed = async (sessionId: string | null, paymentIntent: string | null) => {
  await prisma.$executeRaw`
    UPDATE report_orders
    SET status = 'FAILED', stripe_payment_intent = COALESCE(${paymentIntent}::text, stripe_payment_intent), updated_at = CURRENT_TIMESTAMP
    WHERE status = 'PENDING'
      AND (
        (${sessionId}::text IS NOT NULL AND stripe_session_id = ${sessionId}::text)
        OR (${paymentIntent}::text IS NOT NULL AND stripe_payment_intent = ${paymentIntent}::text)
      )
  `;
};

export const markOrderCancelled = async (sessionId: string) => {
  await prisma.$executeRaw`UPDATE report_orders SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE stripe_session_id = ${sessionId} AND status = 'PENDING'`;
};

export const listReportOrders = async (userId: string) => prisma.$queryRaw<ReportOrderRow[]>`
  SELECT report_orders.order_id AS "orderId", report_orders.user_id AS "userId", report_orders.score_report_id AS "scoreReportId",
    report_orders.stripe_session_id AS "stripeSessionId", report_orders.stripe_payment_intent AS "stripePaymentIntent",
    report_orders.amount, report_orders.currency, report_orders.status, report_orders.paid_at AS "paidAt", report_orders.created_at AS "createdAt",
    score_reports.status AS "reportStatus"
  FROM report_orders
  LEFT JOIN score_reports ON score_reports.score_report_id = report_orders.score_report_id
  WHERE report_orders.user_id = ${userId}::uuid ORDER BY report_orders.created_at DESC
`;

export const claimWebhookEvent = async (eventId: string, eventType: string) => {
  const claimed = await prisma.$executeRaw`
    INSERT INTO payment_webhook_events (event_id, event_type, status)
    VALUES (${eventId}, ${eventType}, 'PROCESSING')
    ON CONFLICT (event_id) DO UPDATE
      SET status = 'PROCESSING', processed_at = CURRENT_TIMESTAMP
      WHERE payment_webhook_events.status = 'FAILED'
        OR payment_webhook_events.processed_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
  `;
  return claimed === 1;
};

export const completeWebhookEvent = async (eventId: string) => {
  await prisma.$executeRaw`
    UPDATE payment_webhook_events
    SET status = 'COMPLETED', processed_at = CURRENT_TIMESTAMP
    WHERE event_id = ${eventId}
  `;
};

export const failWebhookEvent = async (eventId: string) => {
  await prisma.$executeRaw`
    UPDATE payment_webhook_events
    SET status = 'FAILED', processed_at = CURRENT_TIMESTAMP
    WHERE event_id = ${eventId}
  `;
};
