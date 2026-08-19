import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import request from 'supertest';
import app from '@/index';
import prisma from '@/config/database';
import { generateAccessToken } from '@/utils/jwt.token';
import { UserRole } from '@/generated/prisma/enums';

describe('Score report integration', () => {
  let adminToken: string;
  let boroughId: string;
  let postcodeId: string;
  let scoreReportId: string;

  before(async () => {
    const userId = '00000000-0000-0000-0000-000000000001';
    const adminTokenObj = generateAccessToken({
      sub: userId,
      email: 'admin-test@roomreview.test',
      role: UserRole.ADMIN,
    });
    adminToken = adminTokenObj.token;

    await prisma.user.upsert({
      where: { userId },
      update: {
        email: 'admin-test@roomreview.test',
        firstName: 'Admin',
        lastName: 'Test',
        role: UserRole.ADMIN,
        isActive: true,
        isEmailVerified: true,
      },
      create: {
        userId,
        email: 'admin-test@roomreview.test',
        firstName: 'Admin',
        lastName: 'Test',
        passwordHash: 'test',
        role: UserRole.ADMIN,
        isActive: true,
        isEmailVerified: true,
      },
    });

    await prisma.session.upsert({
      where: { userId },
      update: {
        accessTokenId: adminTokenObj.jti,
        accessTokenExpiry: new Date(Date.now() + 1000 * 60 * 15),
      },
      create: {
        userId,
        accessTokenId: adminTokenObj.jti,
        accessTokenExpiry: new Date(Date.now() + 1000 * 60 * 15),
      },
    });

    const borough = await prisma.borough.create({
      data: {
        name: 'Integration Borough',
        slug: `integration-borough-${Date.now()}`,
        metrics: {
          crimeScore: 10,
          affordabilityScore: 50,
          transportScore: 6,
          amenitiesScore: 8,
          healthScore: 70,
          educationScore: 7,
        },
      },
    });
    boroughId = borough.boroughId;

    const postcode = await prisma.postcode.create({
      data: {
        code: `INT${Date.now()}`,
        outcode: 'IN',
        incode: 'TE',
        boroughId,
        metrics: {
          crimeScore: 20,
          affordabilityScore: 40,
          transportScore: 7,
          amenitiesScore: 7,
          healthScore: 65,
          educationScore: 7,
        },
      },
    });
    postcodeId = postcode.postcodeId;
  });

  after(async () => {
    await prisma.scoreReport.deleteMany({ where: { boroughId } }).catch(() => null);
    await prisma.postcode.deleteMany({ where: { boroughId } }).catch(() => null);
    await prisma.borough.deleteMany({ where: { boroughId } }).catch(() => null);
    await prisma.session.deleteMany({ where: { userId: '00000000-0000-0000-0000-000000000001' } }).catch(() => null);
    await prisma.user.deleteMany({ where: { email: 'admin-test@roomreview.test' } }).catch(() => null);
  });

  it('should require valid auth on protected endpoints', async () => {
    const res = await request(app).post('/api/v1/score-reports').send({ boroughId });
    assert.strictEqual(res.status, 401);
    assert.ok(res.body?.error);
  });

  it('should create a score report request', async () => {
    const res = await request(app)
      .post('/api/v1/score-reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ boroughId, name: 'Integration Report' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data?.scoreReportId);
    scoreReportId = res.body.data.scoreReportId;
  });

  it('should return validation error for missing boroughId/postcodeId', async () => {
    const res = await request(app)
      .post('/api/v1/score-reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad Request' });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
  });

  it('should fetch an existing score report', async () => {
    const res = await request(app)
      .get(`/api/v1/score-reports/${scoreReportId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.scoreReportId, scoreReportId);
  });

  it('should generate a preview for a borough', async () => {
    const res = await request(app)
      .post('/api/v1/score-reports/preview')
      .send({ boroughId });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(typeof res.body.data.overallScore, 'number');
    assert.ok(res.body.data.preview?.boroughMetrics);
  });

  it('should reject preview without boroughId or postcodeId', async () => {
    const res = await request(app)
      .post('/api/v1/score-reports/preview')
      .send({});

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
  });

  it('should enqueue report generation and eventually mark it READY', async () => {
    const startRes = await request(app)
      .post(`/api/v1/score-reports/${scoreReportId}/generate`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(startRes.status, 202);
    assert.strictEqual(startRes.body.success, true);

    const waitForReady = async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const getRes = await request(app)
          .get(`/api/v1/score-reports/${scoreReportId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        if (getRes.body.data?.status === 'READY') {
          return getRes.body.data;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error('Score report did not reach READY status in time');
    };

    const readyReport = await waitForReady();
    assert.strictEqual(readyReport.status, 'READY');
    assert.strictEqual(typeof readyReport.overallScore, 'number');
  });

  it('should return PDF for a READY score report', async () => {
    const res = await request(app)
      .get(`/api/v1/score-reports/${scoreReportId}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.header['content-type'], 'application/pdf');
    assert.ok(Buffer.isBuffer(res.body) || typeof res.body === 'string');
  });

  it('should fail PDF download for non-ready report', async () => {
    const tempRes = await request(app)
      .post('/api/v1/score-reports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ postcodeId, name: 'Pending PDF Test' });

    assert.strictEqual(tempRes.status, 201);
    const pendingId = tempRes.body.data.scoreReportId;

    const res = await request(app)
      .get(`/api/v1/score-reports/${pendingId}/pdf`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, 'VALIDATION_ERROR');
  });
});
