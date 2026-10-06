import {
  createScoreReport,
  findScoreReportById,
  updateScoreReport,
  assignScoreReportOwner,
  findScoreReportOwner,
  recoverScoreReportJobs,
  claimNextScoreReportJob,
  listScoreReportsForUser as listScoreReportsForUserRepository,
  softDeleteScoreReportForUser,
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

const getMetricValue = (metrics: Record<string, unknown>, keys: string[]): number | undefined => {
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
  return undefined;
};

const parseMetricNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  const parsed = Number(value.replace(/[^0-9.\-]+/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const withDerivedScoreMetrics = (metrics: Record<string, unknown>): Record<string, unknown> => {
  const derived = { ...metrics };
  const rating = parseMetricNumber(metrics.rating);
  const averageRent = parseMetricNumber(metrics.avgRent);
  const zone = parseMetricNumber(metrics.zones);

  if (getMetricValue(derived, ['score', 'quality']) === undefined && rating !== undefined) {
    derived.score = Math.max(0, Math.min(100, rating * 20));
  }
  if (getMetricValue(derived, ['affordabilityScore', 'costOfLiving', 'medianRent', 'medianPrice']) === undefined && averageRent !== undefined) {
    derived.affordabilityScore = Math.max(0, Math.min(100, (averageRent / 4000) * 100));
  }
  if (getMetricValue(derived, ['transportScore', 'accessScore', 'publicTransportScore', 'commuteScore']) === undefined && zone !== undefined) {
    derived.transportScore = Math.max(0, Math.min(10, 11 - zone));
  }

  return derived;
};

const calculateMetricsScore = (metrics: Record<string, unknown>): { score: number | null; breakdown: Record<string, number> } => {
  const breakdown: Record<string, number> = {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const category of scoreCategories) {
    const metricValue = getMetricValue(metrics, category.keys);
    if (metricValue === undefined) continue;

    const normalized = normalizeMetric(metricValue, category.max, category.invert) * 100;
    breakdown[category.name] = Math.round(normalized);
    weightedSum += normalized * category.weight;
    totalWeight += category.weight;
  }

  const baselineMetric = getMetricValue(metrics, ['score', 'quality']);
  if (totalWeight === 0 && baselineMetric === undefined) {
    return { score: null, breakdown };
  }

  const baseline = baselineMetric === undefined ? null : normalizeMetric(baselineMetric, 100, false) * 100;
  const combined = totalWeight > 0 ? weightedSum / totalWeight : baseline!;
  const score = baseline === null ? Math.round(combined) : Math.round((baseline * 0.12) + (combined * 0.88));

  return { score: Math.max(0, Math.min(100, score)), breakdown };
};

const combineScores = (boroughScore: number | null, postcodeScore: number | null): number | null => {
  if (boroughScore === null && postcodeScore === null) return null;
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

type PdfTextLine = { text: string; kind: 'title' | 'section' | 'body' | 'muted' };

const pdfTextStyles = {
  title: { font: 'F2', size: 20, color: '0.10 0.15 0.23', height: 30, maxChars: 46 },
  section: { font: 'F2', size: 11, color: '0.55 0.00 0.00', height: 23, maxChars: 70 },
  body: { font: 'F1', size: 10, color: '0.12 0.16 0.22', height: 15, maxChars: 92 },
  muted: { font: 'F1', size: 9, color: '0.35 0.39 0.44', height: 14, maxChars: 98 },
} as const;

const wrapPdfText = (text: string, maxChars: number): string[] => {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const wrapped: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) wrapped.push(current);
      current = '';
      for (let index = 0; index < word.length; index += maxChars) {
        wrapped.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars) {
      wrapped.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) wrapped.push(current);
  return wrapped.length ? wrapped : [''];
};

const formatPdfLabel = (label: string) => label
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/^\w/, (first) => first.toUpperCase());

const appendPdfValue = (lines: PdfTextLine[], label: string, value: unknown) => {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendPdfValue(lines, `${label} ${index + 1}`, item));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      appendPdfValue(lines, `${label} - ${formatPdfLabel(key)}`, nestedValue);
    }
    return;
  }
  lines.push({ text: `${label}: ${String(value)}`, kind: 'body' });
};

const buildPdfBuffer = (
  report: Awaited<ReturnType<typeof getScoreReportById>>,
  preparedForName = '',
): Buffer => {
  const reportData = typeof report.reportData === 'object' && report.reportData !== null && !Array.isArray(report.reportData)
    ? report.reportData as Record<string, unknown>
    : {};
  const reportScores = typeof reportData.scores === 'object' && reportData.scores !== null
    ? reportData.scores as Record<string, unknown>
    : {};
  const lines: PdfTextLine[] = [
    { text: 'RoomReview Score Report', kind: 'title' },
    { text: 'Report details', kind: 'section' },
    ...(preparedForName ? [{ text: `Prepared for: ${preparedForName}`, kind: 'body' as const }] : []),
    { text: `Report ID: ${report.scoreReportId}`, kind: 'muted' },
    { text: `Name: ${report.name ?? 'N/A'}`, kind: 'body' },
    { text: `Status: ${report.status}`, kind: 'body' },
    { text: `Created: ${new Date(report.createdAt).toLocaleDateString('en-GB')}`, kind: 'body' },
  ];

  if (report.description) lines.push({ text: `Description: ${report.description}`, kind: 'body' });

  const borough = reportData.borough;
  const postcode = reportData.postcode;
  if (borough || postcode) {
    lines.push({ text: 'Location', kind: 'section' });
    if (borough) lines.push({ text: `Borough: ${String(borough)}`, kind: 'body' });
    if (postcode) lines.push({ text: `Postcode: ${String(postcode)}`, kind: 'body' });
  }

  lines.push({ text: 'Scores', kind: 'section' });
  lines.push({ text: `Overall score: ${report.overallScore ?? reportScores.overallScore ?? 'N/A'}`, kind: 'body' });
  lines.push({ text: `Borough score: ${report.boroughScore ?? reportScores.boroughScore ?? 'N/A'}`, kind: 'body' });
  lines.push({ text: `Postcode score: ${report.postcodeScore ?? reportScores.postcodeScore ?? 'N/A'}`, kind: 'body' });

  const scoreBreakdown = report.scoreBreakdown ?? reportData.scoreBreakdown;
  if (scoreBreakdown && typeof scoreBreakdown === 'object') {
    lines.push({ text: 'Score breakdown', kind: 'section' });
    appendPdfValue(lines, 'Score', scoreBreakdown);
  }

  if (typeof reportData.summary === 'string' && reportData.summary.trim()) {
    lines.push({ text: 'Summary', kind: 'section' });
    lines.push({ text: reportData.summary, kind: 'body' });
  }

  const omittedReportDataKeys = new Set(['borough', 'postcode', 'scores', 'scoreBreakdown', 'summary', 'createdAt']);
  const additionalData = Object.fromEntries(Object.entries(reportData).filter(([key]) => !omittedReportDataKeys.has(key)));
  if (Object.keys(additionalData).length) {
    lines.push({ text: 'Additional report data', kind: 'section' });
    for (const [key, value] of Object.entries(additionalData)) {
      appendPdfValue(lines, formatPdfLabel(key), value);
    }
  }

  const expandedLines = lines.flatMap((line) => {
    const style = pdfTextStyles[line.kind];
    return wrapPdfText(line.text, style.maxChars).map((text) => ({ ...line, text }));
  });
  const pages: PdfTextLine[][] = [[]];
  let usedHeight = 0;
  for (const line of expandedLines) {
    const lineHeight = pdfTextStyles[line.kind].height;
    if (usedHeight + lineHeight > 680) {
      pages.push([]);
      usedHeight = 0;
    }
    pages[pages.length - 1].push(line);
    usedHeight += lineHeight;
  }

  const pageObjectRefs = pages.map((_, index) => `${5 + index * 2} 0 R`).join(' ');
  const objectStrings = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n',
    `2 0 obj<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectRefs}] >>endobj\n`,
    '3 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n',
    '4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n',
  ];

  pages.forEach((page, pageIndex) => {
    const pageObjectId = 5 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    let y = 750;
    const commands = page.map((line) => {
      const style = pdfTextStyles[line.kind];
      const command = `${style.color} rg BT /${style.font} ${style.size} Tf 50 ${y} Td (${escapePdfText(line.text)}) Tj ET`;
      y -= style.height;
      return command;
    });
    commands.push(`0.45 0.48 0.52 rg BT /F1 8 Tf 50 30 Td (${pageIndex + 1} / ${pages.length}) Tj ET`);
    const stream = commands.join('\n');
    const streamBytes = Buffer.from(stream, 'utf8');
    objectStrings.push(
      `${pageObjectId} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>endobj\n`,
      `${contentObjectId} 0 obj<< /Length ${streamBytes.length} >>stream\n${stream}\nendstream\nendobj\n`,
    );
  });

  let offset = Buffer.byteLength('%PDF-1.1\n');
  const xrefEntries = ['0000000000 65535 f \n'];
  for (const objectString of objectStrings) {
    xrefEntries.push(`${offset.toString().padStart(10, '0')} 00000 n \n`);
    offset += Buffer.byteLength(objectString);
  }

  const xrefStart = offset;
  const xref = `xref\n0 ${objectStrings.length + 1}\n${xrefEntries.join('')}`;
  const trailer = `trailer<< /Size ${objectStrings.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.concat([
    Buffer.from('%PDF-1.1\n', 'utf8'),
    Buffer.from(objectStrings.join(''), 'utf8'),
    Buffer.from(xref, 'utf8'),
    Buffer.from(trailer, 'utf8'),
  ]);
};

const calculateMetrics = (metrics: Record<string, unknown> = {}) => {
  const { score, breakdown } = calculateMetricsScore(withDerivedScoreMetrics(metrics));
  return { score, breakdown };
};

const calculateLocationScores = (
  boroughMetrics: Record<string, unknown>,
  hasPostcode: boolean,
  postcodeMetrics: Record<string, unknown> = boroughMetrics,
) => {
  const boroughResult = calculateMetrics(boroughMetrics);
  const postcodeResult = hasPostcode ? calculateMetrics(postcodeMetrics) : { score: null, breakdown: {} };

  return {
    boroughResult,
    postcodeResult,
    overallScore: combineScores(boroughResult.score, postcodeResult.score),
  };
};

export const _calculateMetricsScoreForTest = (metrics: Record<string, unknown>) => calculateMetricsScore(withDerivedScoreMetrics(metrics));
export const _calculateLocationScoresForTest = calculateLocationScores;
export const _buildPdfBufferForTest = buildPdfBuffer;

export const createScoreReportRequest = async (data: CreateScoreRequestDto, userId: string) => {
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

  const reportData = data.reportData;
  const reportMeta = typeof reportData?.meta === 'object' && reportData.meta !== null
    ? reportData.meta as Record<string, unknown>
    : {};
  const reportMetrics = typeof reportData?.metrics === 'object' && reportData.metrics !== null
    ? reportData.metrics as Record<string, unknown>
    : {};
  const overallScoreValue = reportMeta.overallScore ?? reportMetrics.score;
  const overallScore = typeof overallScoreValue === 'number' && Number.isFinite(overallScoreValue)
    ? overallScoreValue
    : undefined;

  const report = await createScoreReport({
    borough: data.boroughId ? { connect: { boroughId: data.boroughId } } : undefined,
    postcode: data.postcodeId ? { connect: { postcodeId: data.postcodeId } } : undefined,
    name: data.name,
    description: data.description,
    status: reportData ? ScoreStatus.READY : ScoreStatus.WAITING,
    overallScore,
    scoreBreakdown: (reportData?.scoreBreakdown ?? reportData?.availableScoreCategories) as any,
    reportData: reportData as any,
  });
  await assignScoreReportOwner(report.scoreReportId, userId);
  return report;
};

export const getScoreReportOwner = (id: string) => findScoreReportOwner(id);

export const listScoreReportsForUser = async (userId: string, requestedPage = 1, requestedLimit = 5) => {
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.min(5, Math.max(1, Math.floor(requestedLimit))) : 5;
  const { reports, total } = await listScoreReportsForUserRepository(userId, (page - 1) * limit, limit);

  return {
    reports: reports.map(({ reportOrders, reportData, ...report }) => {
      const reportType = typeof reportData === 'object' && reportData !== null && !Array.isArray(reportData)
        ? (reportData as Record<string, unknown>).reportType
        : null;
      return {
        ...report,
        hasFullReport: reportType === 'buyer' || reportType === 'investor',
        order: reportOrders[0] ?? null,
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const deleteUserScoreReport = async (scoreReportId: string, userId: string) => {
  const deleted = await softDeleteScoreReportForUser(scoreReportId, userId);
  if (!deleted) {
    throw new EntityNotFoundError({ message: 'Report not found', code: 'ENTITY_NOT_FOUND' });
  }
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
  const postcode = report.postcodeId ? await findPostcodeById(report.postcodeId) : null;
  const boroughId = report.boroughId ?? (postcode as any)?.boroughId;
  const borough = boroughId ? await findBoroughById(boroughId) : null;

  const boroughMetrics = (borough ? (borough as any).metrics as Record<string, unknown> : {}) ?? {};
  const postcodeMetrics = (postcode ? (postcode as any).metrics as Record<string, unknown> : {}) ?? {};
  const { boroughResult, postcodeResult, overallScore } = calculateLocationScores(boroughMetrics, Boolean(postcode), postcodeMetrics);
  const scoreBreakdown = {
    borough: boroughResult.breakdown,
    postcode: postcodeResult.breakdown,
  };

  const boroughScore = boroughResult.score;
  const postcodeScore = postcodeResult.score;

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

const processNextScoreReportJob = async () => {
  await recoverScoreReportJobs();
  const job = await claimNextScoreReportJob();
  if (!job) return false;

  logContext.function = 'processNextScoreReportJob';
  try {
    await generateScoreReportNow(job.scoreReportId);
  } catch (error) {
    logger.error(logContext, 'Background score report generation failed', { error, scoreReportId: job.scoreReportId });
    await updateScoreReport(job.scoreReportId, {
      status: ScoreStatus.FAILED,
      failureReason: error instanceof Error ? error.message : 'Unknown error',
    }).catch(() => null);
  }
  return true;
};

export const processScoreReportJobsOnce = async () => {
  while (await processNextScoreReportJob()) {
  }
};

let scoreReportWorkerStarted = false;

export const startScoreReportWorker = async () => {
  if (scoreReportWorkerStarted) return;
  scoreReportWorkerStarted = true;

  const run = async () => {
    try {
      await processScoreReportJobsOnce();
    } catch (error) {
      logger.error(logContext, 'Score report worker poll failed', { error });
    } finally {
      setTimeout(run, 1000).unref();
    }
  };

  void run();
};

export const enqueueScoreReportGeneration = async (id: string) => {
  const report = await getScoreReportById(id);
  if (report.status === ScoreStatus.GENERATING || report.status === ScoreStatus.READY) {
    return report;
  }
  await updateScoreReport(id, { status: ScoreStatus.WAITING, failureReason: null });
  return await getScoreReportById(id);
};

export const previewScoreReport = async (data: ScorePreviewDto) => {
  if (!data.boroughId && !data.postcodeId) {
    throw new ValidationError({
      message: 'Either boroughId or postcodeId must be provided',
      code: 'VALIDATION_ERROR',
    });
  }

  const postcode = data.postcodeId ? await findPostcodeById(data.postcodeId) : null;
  if (data.postcodeId && !postcode) {
    throw new EntityNotFoundError({
      message: `Postcode with ID ${data.postcodeId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  const boroughId = data.boroughId ?? (postcode as any)?.boroughId;
  const borough = boroughId ? await findBoroughById(boroughId) : null;
  if (boroughId && !borough) {
    throw new EntityNotFoundError({
      message: `Borough with ID ${boroughId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  const { boroughResult, postcodeResult, overallScore } = calculateLocationScores(
    ((borough as any)?.metrics as Record<string, unknown>) ?? {},
    Boolean(postcode),
    ((postcode as any)?.metrics as Record<string, unknown>) ?? {},
  );

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

export const generateScoreReportPdf = async (id: string, preparedForName = '') => {
  const report = await getScoreReportById(id);
  if (report.status !== ScoreStatus.READY) {
    throw new ValidationError({
      message: 'Score report must be READY before PDF generation',
      code: 'VALIDATION_ERROR',
    });
  }
  return buildPdfBuffer(report, preparedForName);
};
