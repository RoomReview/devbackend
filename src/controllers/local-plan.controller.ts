import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import prisma from '@config/database';

export const getAllLocalPlans = async (req: Request, res: Response): Promise<void> => {
  const borough = String(req.query.borough ?? '').trim();
  const data = await prisma.local_plans.findMany({
    where: borough ? { borough: { equals: borough, mode: 'insensitive' } } : undefined,
    orderBy: [{ borough: 'asc' }, { category: 'asc' }],
  });
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data, message: 'Local plans fetched successfully' };
  res.status(200).json(response);
};

export const getLocalPlanById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Local plan fetched successfully' };
  res.status(200).json(response);
};

export const createLocalPlan = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Local plan created successfully' };
  res.status(201).json(response);
};

export const updateLocalPlan = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Local plan updated successfully' };
  res.status(200).json(response);
};

export const deleteLocalPlan = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Local plan deleted successfully' };
  res.status(200).json(response);
};

