import {
  createScoreReport,
  findScoreReportById,
  updateScoreReport,
} from '@/repositories/score-report.repository';
import { findBoroughById } from '@/repositories/borough.repository';
import { findPostcodeById } from '@/repositories/postcode.repository';
import logger, { LogContext } from '@/utils/logger';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import type { CreateScoreRequestDto, ScorePreviewDto } from '@/dto/score.dto';
import { ScoreStatus } from '@/dto/score.dto';

const logContext: LogContext = {
  service: 'ScoreReportService',
  function: '',
};

const scoreCategories = [
  {
    name: 'safety',
    keys: ['crimeScore', 'crimeIndex', 'crimeRate'],
    max: 100,
    invert: true,
    weight: 0.2,
  },
  {
    name: 'affordability',
    keys: ['affordabilityScore', 'costOfLiving', 'medianRent', 'medianPrice'],
    max: 100,
    invert: true,
    weight: 0.2,
  },
  {
    name: 'transport',
    keys: ['transportScore', 'accessScore', 'publicTransportScore', 'commuteScore'],
    max: 10,
    invert: false,
    weight: 0.18,
  },
  {
    name: 'amenities',
    keys: ['amenitiesScore', 'walkScore', 'leisureScore'],
    max: 10,
    invert: false,
    weight: 0.16,
  },
  {
    name: 'health',
    keys: ['healthScore', 'airQuality', 'greenSpace'],
    max: 100,
    invert: false,
    weight: 0.13,
  },
  {
    name: 'education',
    keys: ['educationScore', 'schoolScore'],
    max: 10,
    invert: false,
    weight: 0.13,
  },
];

const normalizeMetric = (value: unknown, max = 100, invert = false): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return 0;
  const normalized = Math.max(0, Math.min(1, numeric / max));
  return invert ? 1 - normalized : normalized;
};

const getMetricValue = (metrics: Record<string, unknown>, keys: string[]): number => {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value.replace(/[^0-9.\-]+/g, ''));
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
};

const calculateMetricsScore = (metrics: Record<string, unknown>): { score: number; breakdown: Record<string, number> } => {
  const breakdown: Record<string, number> = {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const category of scoreCategories) {
    const metricValue = getMetricValue(metrics, category.keys);
    const normalized = normalizeMetric(metricValue, category.max, category.invert) * 100;
    breakdown[category.name] = Math.round(normalized);
    weightedSum += normalized * category.weight;
    totalWeight += category.weight;
  }

  const baseline = normalizeMetric(metrics['score'] ?? metrics['quality'] ?? 60, 100, false) * 100;
  const combined = totalWeight > 0 ? weightedSum / totalWeight : baseline;
  const score = Math.round((baseline * 0.12) + (combined * 0.88));

  return { score: Math.max(0, Math.min(100, score)), breakdown };
};

const combineScores = (boroughScore: number | null, postcodeScore: number | null): number => {
  if (boroughScore !== null && postcodeScore !== null) {
    return Math.round(boroughScore * 0.55 + postcodeScore * 0.45);
  }
  return Math.round(boroughScore ?? postcodeScore ?? 0);
};

const buildReportPayload = (
  report: Awaited<ReturnType<typeof getScoreReportById>>,
  boroughName: string | null,
  postcodeCode: string | null,
  boroughScore: number | null,
  postcodeScore: number | null,
  scoreBreakdown: Record<string, unknown>,
) => ({
  summary: `RoomReview Score Report for ${report.name ?? boroughName ?? postcodeCode ?? report.scoreReportId}`,
  borough: boroughName,
  postcode: postcodeCode,
  scores: {
    boroughScore,
    postcodeScore,
    overallScore: combineScores(boroughScore, postcodeScore),
  },
  scoreBreakdown,
  createdAt: new Date().toISOString(),
});

const escapePdfText = (text: string) => {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
};

const buildPdfBuffer = (report: Awaited<ReturnType<typeof getScoreReportById>>): Buffer => {
  const lines = [
    'RoomReview Score Report',
    `Report ID: ${report.scoreReportId}`,
    `Status: ${report.status}`,
    `Name: ${report.name ?? 'N/A'}`,
    `Description: ${report.description ?? 'N/A'}`,
    `Overall score: ${report.overallScore ?? 'N/A'}`,
    `Borough score: ${report.boroughScore ?? 'N/A'}`,
    `Postcode score: ${report.postcodeScore ?? 'N/A'}`,
    '---',
    'Score breakdown:',
  ];

  const breakdown = typeof report.scoreBreakdown === 'object' && report.scoreBreakdown !== null ? report.scoreBreakdown : {};
  for (const [key, value] of Object.entries(breakdown as Record<string, unknown>)) {
    lines.push(`${key}: ${value ?? 'N/A'}`);
  }

  lines.push('---');
  lines.push('Report data:');
  const data = typeof report.reportData === 'object' && report.reportData !== null ? report.reportData : {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }

  const textStreamLines = lines.map((line, index) => {
    const escaped = escapePdfText(line);
    return index === 0
      ? `(${escaped}) Tj
`
      : `T* (${escaped}) Tj
`;
  }).join('');

  const stream = `BT /F1 12 Tf 50 760 Td ${textStreamLines}ET`;
  const streamBytes = Buffer.from(stream, 'utf8');

  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
    '2 0 obj<< /Type /Pages /Count 1 /Kids [3 0 R] >>endobj\n',
    `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>endobj\n`,
    '4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n',
    `5 0 obj<< /Length ${streamBytes.length} >>stream\n${stream}\nendstream\nendobj\n`,
  ].join('');

  const xrefStart = Buffer.byteLength(`%PDF-1.1\n`) + Buffer.byteLength(objects);
  const xref = [
    'xref\n',
    '0 6\n',
    '0000000000 65535 f \n',
  ];

  let offset = Buffer.byteLength('%PDF-1.1\n');
  const objectStrings = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
    '2 0 obj<< /Type /Pages /Count 1 /Kids [3 0 R] >>endobj\n',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>endobj\n',
    '4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n',
    `5 0 obj<< /Length ${streamBytes.length} >>stream\n${stream}\nendstream\nendobj\n`,
  ];

  for (const obj of objectStrings) {
    xref.push(offset.toString().padStart(10, '0') + ' 00000 n \n');
    offset += Buffer.byteLength(obj);
  }

  const trailer = `trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  const pdfBuffer = Buffer.concat([
    Buffer.from('%PDF-1.1\n', 'utf8'),
    Buffer.from(objects, 'utf8'),
    Buffer.from(xref.join(''), 'utf8'),
    Buffer.from(trailer, 'utf8'),
  ]);

  return pdfBuffer;
};

const calculateMetrics = (metrics: Record<string, unknown> = {}) => {
  const { score, breakdown } = calculateMetricsScore(metrics);
  return { score, breakdown };
};

export const _calculateMetricsScoreForTest = calculateMetricsScore;
export const _buildPdfBufferForTest = buildPdfBuffer;

export const createScoreReportRequest = async (data: CreateScoreRequestDto) => {
  if (!data.boroughId && !data.postcodeId) {
    throw new ValidationError({
      message: 'Either boroughId or postcodeId must be provided',
      code: 'VALIDATION_ERROR',
    });
  }

  const borough = data.boroughId ? await findBoroughById(data.boroughId) : null;
  if (data.boroughId && !borough) {
    throw new EntityNotFoundError({
      message: `Borough with ID ${data.boroughId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  const postcode = data.postcodeId ? await findPostcodeById(data.postcodeId) : null;
  if (data.postcodeId && !postcode) {
    throw new EntityNotFoundError({
      message: `Postcode with ID ${data.postcodeId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  return await createScoreReport({
    borough: data.boroughId ? { connect: { boroughId: data.boroughId } } : undefined,
    postcode: data.postcodeId ? { connect: { postcodeId: data.postcodeId } } : undefined,
    name: data.name,
    description: data.description,
    status: ScoreStatus.WAITING,
  });
};

export const getScoreReportById = async (id: string) => {
  const report = await findScoreReportById(id);
  if (!report) {
    throw new EntityNotFoundError({
      message: `Score report with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return report;
};

export const calculateBoroughScore = async (boroughId: string) => {
  const borough = await findBoroughById(boroughId);
  if (!borough) {
    throw new EntityNotFoundError({ message: `Borough with ID ${boroughId} not found`, code: 'ENTITY_NOT_FOUND' });
  }
  const metrics = (borough as any).metrics as Record<string, unknown> ?? {};
  const { score, breakdown } = calculateMetrics(metrics);
  return { score, breakdown, name: (borough as any).name };
};

export const calculatePostcodeScore = async (postcodeId: string) => {
  const postcode = await findPostcodeById(postcodeId);
  if (!postcode) {
    throw new EntityNotFoundError({ message: `Postcode with ID ${postcodeId} not found`, code: 'ENTITY_NOT_FOUND' });
  }
  const metrics = (postcode as any).metrics as Record<string, unknown> ?? {};
  const { score, breakdown } = calculateMetrics(metrics);
  return { score, breakdown, code: (postcode as any).code };
};

const generateScoreReportNow = async (id: string) => {
  const report = await getScoreReportById(id);
  const borough = report.boroughId ? await findBoroughById(report.boroughId) : null;
  const postcode = report.postcodeId ? await findPostcodeById(report.postcodeId) : null;

  const boroughMetrics = (borough ? (borough as any).metrics as Record<string, unknown> : {}) ?? {};
  const postcodeMetrics = (postcode ? (postcode as any).metrics as Record<string, unknown> : {}) ?? {};

  const boroughResult = borough ? calculateMetrics(boroughMetrics) : { score: null, breakdown: {} };
  const postcodeResult = postcode ? calculateMetrics(postcodeMetrics) : { score: null, breakdown: {} };
  const scoreBreakdown = {
    borough: boroughResult.breakdown,
    postcode: postcodeResult.breakdown,
  };

  const boroughScore = boroughResult.score;
  const postcodeScore = postcodeResult.score;
  const overallScore = combineScores(boroughScore, postcodeScore);

  const reportData = buildReportPayload(
    report,
    borough?.name ?? null,
    (postcode as any)?.code ?? null,
    boroughScore,
    postcodeScore,
    scoreBreakdown,
  );

  return await updateScoreReport(id, {
    status: ScoreStatus.READY,
    overallScore,
    boroughScore,
    postcodeScore,
    scoreBreakdown,
    reportData: reportData as any,
    failureReason: null,
  });
};

const scheduleScoreReportGeneration = (id: string) => {
  setImmediate(async () => {
    logContext.function = 'scheduleScoreReportGeneration';
    try {
      await generateScoreReportNow(id);
    } catch (error) {
      logger.error(logContext, 'Background score report generation failed', { error, scoreReportId: id });
      await updateScoreReport(id, {
        status: ScoreStatus.FAILED,
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      }).catch(() => null);
    }
  });
};

export const enqueueScoreReportGeneration = async (id: string) => {
  const report = await getScoreReportById(id);
  if (report.status === ScoreStatus.GENERATING) {
    return report;
  }
  await updateScoreReport(id, { status: ScoreStatus.GENERATING });
  scheduleScoreReportGeneration(id);
  return await getScoreReportById(id);
};

export const previewScoreReport = async (data: ScorePreviewDto) => {
  if (!data.boroughId && !data.postcodeId) {
    throw new ValidationError({
      message: 'Either boroughId or postcodeId must be provided',
      code: 'VALIDATION_ERROR',
    });
  }

  const borough = data.boroughId ? await findBoroughById(data.boroughId) : null;
  if (data.boroughId && !borough) {
    throw new EntityNotFoundError({
      message: `Borough with ID ${data.boroughId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  const postcode = data.postcodeId ? await findPostcodeById(data.postcodeId) : null;
  if (data.postcodeId && !postcode) {
    throw new EntityNotFoundError({
      message: `Postcode with ID ${data.postcodeId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  const boroughResult = borough ? calculateMetrics((borough as any).metrics as Record<string, unknown> ?? {}) : { score: null, breakdown: {} };
  const postcodeResult = postcode ? calculateMetrics((postcode as any).metrics as Record<string, unknown> ?? {}) : { score: null, breakdown: {} };
  const overallScore = combineScores(boroughResult.score, postcodeResult.score);

  return {
    borough: (borough as any)?.name,
    postcode: (postcode as any)?.code,
    overallScore,
    boroughScore: boroughResult.score,
    postcodeScore: postcodeResult.score,
    scoreBreakdown: {
      borough: boroughResult.breakdown,
      postcode: postcodeResult.breakdown,
    },
    preview: {
      boroughMetrics: (borough as any)?.metrics,
      postcodeMetrics: (postcode as any)?.metrics,
    },
  };
};

export const generateScoreReportPdf = async (id: string) => {
  const report = await getScoreReportById(id);
  if (report.status !== ScoreStatus.READY) {
    throw new ValidationError({
      message: 'Score report must be READY before PDF generation',
      code: 'VALIDATION_ERROR',
    });
  }
  return buildPdfBuffer(report);
};
