import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  _buildPdfBufferForTest,
  _calculateLocationScoresForTest,
  _calculateMetricsScoreForTest,
} from '../services/score-report.service';

const boroughMetrics = {
  score: 75,
  crimeScore: 10,
  affordabilityScore: 20,
  transportScore: 8,
  amenitiesScore: 7,
  healthScore: 70,
  educationScore: 8,
};

// postcodeMetrics intentionally omitted; tests focus on borough metrics and PDF builder

describe('score-report.service (pure functions)', () => {
  it('should compute category-level normalized values', () => {
    const { score, breakdown } = _calculateMetricsScoreForTest(boroughMetrics);
    assert.strictEqual(typeof score, 'number');
    assert.deepStrictEqual(breakdown, {
      safety: 90,
      affordability: 80,
      transport: 80,
      amenities: 70,
      health: 70,
      education: 80,
    });
    assert.strictEqual(score, 79);
  });

  it('should reuse borough metrics when scoring a postcode', () => {
    const borough = _calculateLocationScoresForTest(boroughMetrics, true);

    assert.strictEqual(borough.postcodeResult.score, borough.boroughResult.score);
    assert.deepStrictEqual(borough.postcodeResult.breakdown, borough.boroughResult.breakdown);
    assert.strictEqual(borough.overallScore, borough.boroughResult.score);
  });

  it('should use a provided baseline score when category metrics are missing', () => {
    const { score, breakdown } = _calculateMetricsScoreForTest({ score: 42 });

    assert.strictEqual(score, 42);
    assert.deepStrictEqual(breakdown, {});
  });

  it('should not invent a score when all scoring metrics are missing', () => {
    const { score, breakdown } = _calculateMetricsScoreForTest({ population: 1000 });

    assert.strictEqual(score, null);
    assert.deepStrictEqual(breakdown, {});
  });

  it('should calculate a score from stored borough summary metrics', () => {
    const { score, breakdown } = _calculateMetricsScoreForTest({
      trend: '3.8%',
      zones: 'Zone 1',
      rating: 4.7,
      avgRent: '£2,950',
      reviewCount: 8,
    });

    assert.strictEqual(typeof score, 'number');
    assert.ok((score ?? 0) > 0);
    assert.deepStrictEqual(breakdown, {
      affordability: 26,
      transport: 100,
    });
  });

  it('should build a non-empty PDF buffer from a synthetic report', () => {
    const fakeReport: any = {
      scoreReportId: 'r-1',
      status: 'READY',
      name: 'Synthetic',
      description: 'For tests',
      overallScore: 88,
      boroughScore: 88,
      postcodeScore: 89,
      scoreBreakdown: { borough: { safety: 90 }, postcode: { safety: 95 } },
      reportData: { sample: true },
    };

    const buf = _buildPdfBufferForTest(fakeReport);
    assert.ok(Buffer.isBuffer(buf));
    assert.ok(buf.length > 0);
    // Basic PDF header check
    assert.strictEqual(buf.toString('utf8', 0, 8), '%PDF-1.1');
  });
});
