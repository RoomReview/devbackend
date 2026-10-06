import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as scoreReportService from '@/services/score-report.service';
import type { CreateScoreRequestDto, ScorePreviewDto } from '@/dto/score.dto';
import type { AuthenticatedRequest } from '@/types';
import * as paymentService from '@/services/payment.service';
import { ValidationError } from '@/utils/custom-error';
import { getCurrentUserProfile } from '@/services/user.service';

const getSingleParamValue = (value: string | string[] | undefined): string => {
  if (typeof value === 'string') {
    return value;
  }

  return value?.[0] ?? '';
};

export const createScoreReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await scoreReportService.createScoreReportRequest(req.body as CreateScoreRequestDto, req.user!.userId);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Score report request created successfully',
  };
  res.status(201).json(response);
};

export const listMyScoreReports = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const queryValue = (value: unknown, fallback: number) => {
    const parsed = Number(Array.isArray(value) ? value[0] : value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  };
  const data = await scoreReportService.listScoreReportsForUser(
    req.user!.userId,
    queryValue(req.query.page, 1),
    queryValue(req.query.limit, 5),
  );

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'User reports fetched successfully',
  };
  res.status(200).json(response);
};

export const deleteMyScoreReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = getSingleParamValue(req.params.id);
  await scoreReportService.deleteUserScoreReport(id, req.user!.userId);
  const response: ApiResponse<{ scoreReportId: string }> = {
    success: true,
    statusCode: 200,
    data: { scoreReportId: id },
    message: 'Report removed from your saved reports',
  };
  res.status(200).json(response);
};

export const getScoreReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = getSingleParamValue(req.params.id);
  await paymentService.assertReportOwner(id, req.user!.userId);
  const data = await scoreReportService.getScoreReportById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Score report fetched successfully',
  };
  res.status(200).json(response);
};

export const enqueueScoreReportGeneration = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = getSingleParamValue(req.params.id);
  await paymentService.assertPaidReportAccess(id, req.user!.userId);
  const data = await scoreReportService.enqueueScoreReportGeneration(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 202,
    data,
    message: 'Score report generation started',
  };
  res.status(202).json(response);
};

export const previewScoreReport = async (req: Request, res: Response): Promise<void> => {
  const data = await scoreReportService.previewScoreReport(req.body as ScorePreviewDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Score report preview generated successfully',
  };
  res.status(200).json(response);
};

export const getScoreReportPdf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = getSingleParamValue(req.params.id);
  await paymentService.assertReportOwner(id, req.user!.userId);
  const report = await scoreReportService.getScoreReportById(id);
  if (report.status !== 'READY') {
    throw new ValidationError({
      message: 'Score report must be READY before PDF generation',
      code: 'VALIDATION_ERROR',
    });
  }
  await paymentService.assertPaidReportAccess(id, req.user!.userId);
  const profile = await getCurrentUserProfile(req.user!.userId);
  const preparedForName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
  const pdfBuffer = await scoreReportService.generateScoreReportPdf(id, preparedForName);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="score-report-${id}.pdf"`);
  res.status(200).send(pdfBuffer);
};
