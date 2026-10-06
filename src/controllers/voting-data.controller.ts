import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import prisma from '@config/database';

export const getAllVotingData = async (req: Request, res: Response): Promise<void> => {
  const borough = String(req.query.borough ?? '').trim();
  const data = await prisma.voting_data.findMany({
    where: borough ? { borough: { equals: borough, mode: 'insensitive' } } : undefined,
    orderBy: [{ year: 'desc' }, { party: 'asc' }],
  });
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data, message: 'Voting data fetched successfully' };
  res.status(200).json(response);
};

export const getVotingDataById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Voting data fetched successfully' };
  res.status(200).json(response);
};

export const createVotingData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Voting data created successfully' };
  res.status(201).json(response);
};

export const bulkCreateVotingData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Voting data bulk created successfully' };
  res.status(201).json(response);
};

export const updateVotingData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Voting data updated successfully' };
  res.status(200).json(response);
};

export const deleteVotingData = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Voting data deleted successfully' };
  res.status(200).json(response);
};
