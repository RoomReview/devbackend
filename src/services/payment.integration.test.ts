import assert from 'node:assert';
import { createHmac, randomUUID } from 'node:crypto';
import { describe, it, before, after, mock } from 'node:test';
import request from 'supertest';
import app from '../index';
import config from '../config/index';
import prisma from '../config/database';
import { generateAccessToken } from '../utils/jwt.token';
import { UserRole } from '../generated/prisma/enums';
import { processScoreReportJobsOnce } from './score-report.service';

const userId = '00000000-0000-0000-0000-000000000021';
const otherUserId = '00000000-0000-0000-0000-000000000022';

const signWebhook = (payload: string) => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const digest = createHmac('sha256', config.stripeWebhookSecret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return `t=${timestamp},v1=${digest}`;
};

describe('Stripe payment integration', () => {
  let token: string;
  let otherToken: string;
  let reportId: string;
  let failedReportId: string;
  let checkoutCall = 0;
  const checkoutSessionIds = [`cs_test_${randomUUID()}`, `cs_test_${randomUUID()}`];

  before(async () => {
    if (!config.stripeSecretKey || !config.stripeWebhookSecret) {
      throw new Error('Stripe test configuration is required');
    }

    const accessToken = generateAccessToken({
      sub: userId,
      email: 'stripe-test@roomreview.test',
      role: UserRole.TENANT,
    });
    token = accessToken.token;
    const otherAccessToken = generateAccessToken({
      sub: otherUserId,
      email: 'stripe-other-test@roomreview.test',
      role: UserRole.TENANT,
    });
    otherToken = otherAccessToken.token;

    for (const id of [userId, otherUserId]) {
      await prisma.user.upsert({
        where: { userId: id },
        update: { email: `${id === userId ? 'stripe-test' : 'stripe-other'}@roomreview.test`, role: UserRole.TENANT, isActive: true, isEmailVerified: true },
        create: {
          userId: id,
          email: `${id === userId ? 'stripe-test' : 'stripe-other'}@roomreview.test`,
          firstName: 'Stripe',
          lastName: 'Test',
          passwordHash: 'test',
          role: UserRole.TENANT,
          isActive: true,
          isEmailVerified: true,
        },
      });
    }

    await prisma.session.upsert({
      where: { userId },
      update: { accessTokenId: accessToken.jti, accessTokenExpiry: new Date(Date.now() + 900_000) },
      create: { userId, accessTokenId: accessToken.jti, accessTokenExpiry: new Date(Date.now() + 900_000) },
    });
    await prisma.session.upsert({
      where: { userId: otherUserId },
      update: { accessTokenId: otherAccessToken.jti, accessTokenExpiry: new Date(Date.now() + 900_000) },
      create: { userId: otherUserId, accessTokenId: otherAccessToken.jti, accessTokenExpiry: new Date(Date.now() + 900_000) },
    });

    const report = await prisma.scoreReport.create({
      data: {
        name: 'Stripe integration report',
        status: 'READY',
        overallScore: 82,
        boroughScore: 80,
        postcodeScore: 84,
        scoreBreakdown: { safety: 82 },
        reportData: { source: 'integration-test' },
      },
    });
    await prisma.$executeRaw`
      UPDATE score_reports SET user_id = ${userId}::uuid
      WHERE score_report_id = ${report.scoreReportId}
    `;
    reportId = report.scoreReportId;

    const failedReport = await prisma.scoreReport.create({
      data: { name: 'Failed payment report' },
    });
    await prisma.$executeRaw`
      UPDATE score_reports SET user_id = ${userId}::uuid
      WHERE score_report_id = ${failedReport.scoreReportId}
    `;
    failedReportId = failedReport.scoreReportId;

    mock.method(globalThis, 'fetch', async () => {
      const sessionId = checkoutSessionIds[checkoutCall++];
      return new Response(JSON.stringify({
        id: sessionId,
        url: `https://checkout.stripe.test/${sessionId}`,
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
  });

  after(async () => {
    mock.restoreAll();
    await prisma.$executeRaw`
      DELETE FROM report_orders
      WHERE user_id IN (${userId}::uuid, ${otherUserId}::uuid)
    `.catch(() => null);
    await prisma.scoreReport.deleteMany({ where: { scoreReportId: { in: [reportId, failedReportId] } } }).catch(() => null);
    await prisma.session.deleteMany({ where: { userId: { in: [userId, otherUserId] } } }).catch(() => null);
    await prisma.user.deleteMany({ where: { userId: { in: [userId, otherUserId] } } }).catch(() => null);
  });

  it('creates checkout, fulfils the order from a signed webhook, and lists order history', async () => {
    const checkout = await request(app)
      .post(`/api/v1/payments/reports/${reportId}/checkout`)
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(checkout.status, 200);
    assert.strictEqual(checkout.body.data.checkoutUrl, `https://checkout.stripe.test/${checkoutSessionIds[0]}`);
    assert.strictEqual(checkout.body.data.order.status, 'PENDING');

    const event = JSON.stringify({
      id: `evt_${randomUUID()}`,
      type: 'checkout.session.completed',
      data: { object: { id: checkoutSessionIds[0], mode: 'payment', payment_status: 'paid', payment_intent: 'pi_test_1' } },
    });
    const webhook = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signWebhook(event))
      .send(event);

    assert.strictEqual(webhook.status, 200);
    assert.strictEqual(webhook.body.handled, true);
    await processScoreReportJobsOnce();

    const duplicateWebhook = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signWebhook(event))
      .send(event);
    assert.strictEqual(duplicateWebhook.status, 200);
    assert.strictEqual(duplicateWebhook.body.duplicate, true);

    const history = await request(app)
      .get('/api/v1/payments/orders')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(history.status, 200);
    assert.strictEqual(history.body.data[0].status, 'PAID');
    assert.strictEqual(history.body.data[0].scoreReportId, reportId);
  });

  it('enforces checkout ownership and downloads a paid READY report as PDF', async () => {
    const confirmation = await request(app)
      .get(`/api/v1/payments/checkout/${checkoutSessionIds[0]}`)
      .set('Authorization', `Bearer ${otherToken}`);
    assert.strictEqual(confirmation.status, 401);

    const pdf = await request(app)
      .get(`/api/v1/score-reports/${reportId}/pdf`)
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(pdf.status, 200);
    assert.strictEqual(pdf.headers['content-type'], 'application/pdf');
    assert.strictEqual(pdf.body.toString('utf8', 0, 8), '%PDF-1.1');

    const privatePdf = await request(app)
      .get(`/api/v1/score-reports/${reportId}/pdf`)
      .set('Authorization', `Bearer ${otherToken}`);
    assert.strictEqual(privatePdf.status, 401);
  });

  it('marks a pending order FAILED when Stripe reports a failed payment intent', async () => {
    const checkout = await request(app)
      .post(`/api/v1/payments/reports/${failedReportId}/checkout`)
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(checkout.status, 200);
    await prisma.$executeRaw`
      UPDATE report_orders
      SET stripe_session_id = ${checkoutSessionIds[1]}
      WHERE score_report_id = ${failedReportId} AND user_id = ${userId}::uuid
    `;

    const event = JSON.stringify({
      id: `evt_${randomUUID()}`,
      type: 'checkout.session.async_payment_failed',
      data: { object: { id: checkoutSessionIds[1], payment_intent: 'pi_test_2' } },
    });
    const webhook = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signWebhook(event))
      .send(event);
    assert.strictEqual(webhook.status, 200);

    const history = await request(app)
      .get('/api/v1/payments/orders')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(history.body.data.find((order: { scoreReportId: string }) => order.scoreReportId === failedReportId).status, 'FAILED');
  });
});
