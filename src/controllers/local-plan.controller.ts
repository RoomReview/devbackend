import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as planService from '@/services/local-plan.service';
import type { CreateLocalPlanDto, UpdateLocalPlanDto } from '@/dto/local-plan.dto';

export const getAllLocalPlans = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const filter = {
    borough: req.query.borough as string,
    category: req.query.category as string,
    status: req.query.status as string,
  };

  const result = await planService.getAllLocalPlans(page, limit, filter);

  const response: ApiResponse<typeof result> = {
    success: true,
    statusCode: 200,
    data: result,
    message: 'Local plans fetched successfully',
  };
  res.status(200).json(response);
};

export const getLocalPlanById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await planService.getLocalPlanById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Local plan fetched successfully',
  };
  res.status(200).json(response);
};

export const createLocalPlan = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await planService.createNewLocalPlan(req.body as CreateLocalPlanDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Local plan created successfully',
  };
  res.status(201).json(response);
};

export const updateLocalPlan = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await planService.updateLocalPlanById(id, req.body as UpdateLocalPlanDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Local plan updated successfully',
  };
  res.status(200).json(response);
};

export const deleteLocalPlan = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  await planService.deleteLocalPlanById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Local plan deleted successfully',
  };
  res.status(200).json(response);
};
