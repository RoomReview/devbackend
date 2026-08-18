import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as scoreReportService from '@/services/score-report.service';
import type { CreateScoreRequestDto, ScorePreviewDto } from '@/dto/score.dto';

const getSingleParamValue = (value: string | string[] | undefined): string => {
  if (typeof value === 'string') {
    return value;
  }

  return value?.[0] ?? '';
};

export const createScoreReport = async (req: Request, res: Response): Promise<void> => {
  const data = await scoreReportService.createScoreReportRequest(req.body as CreateScoreRequestDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Score report request created successfully',
  };
  res.status(201).json(response);
};

export const getScoreReport = async (req: Request, res: Response): Promise<void> => {
  const id = getSingleParamValue(req.params.id);
  const data = await scoreReportService.getScoreReportById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Score report fetched successfully',
  };
  res.status(200).json(response);
};

export const enqueueScoreReportGeneration = async (req: Request, res: Response): Promise<void> => {
  const id = getSingleParamValue(req.params.id);
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

export const getScoreReportPdf = async (req: Request, res: Response): Promise<void> => {
  const id = getSingleParamValue(req.params.id);
  const pdfBuffer = await scoreReportService.generateScoreReportPdf(id);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="score-report-${id}.pdf"`);
  res.status(200).send(pdfBuffer);
};
