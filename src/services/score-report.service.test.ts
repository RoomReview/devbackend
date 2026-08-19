import assert from 'node:assert';
import { describe, it } from 'node:test';
import { _calculateMetricsScoreForTest, _buildPdfBufferForTest } from '@/services/score-report.service';

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
