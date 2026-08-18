import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const getAllAgencies = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Agencies fetched successfully' };
  res.status(200).json(response);
};

export const getAgencyById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Agency fetched successfully' };
  res.status(200).json(response);
};

export const createAgency = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Agency created successfully' };
  res.status(201).json(response);
};

export const updateAgency = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Agency updated successfully' };
  res.status(200).json(response);
};

export const verifyAgency = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Agency verified successfully' };
  res.status(200).json(response);
};

export const deleteAgency = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Agency deleted successfully' };
  res.status(200).json(response);
};

export const getAgencyAgents = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Agency agents fetched successfully' };
  res.status(200).json(response);
};

export const verifyAgentInAgency = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Agent verified successfully' };
  res.status(200).json(response);
};
