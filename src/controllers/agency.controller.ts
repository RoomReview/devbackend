import type { Request, Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '@/types';
import * as agencyService from '@/services/agency.service';
import type { CreateAgencyDto, UpdateAgencyDto, VerifyAgencyDto } from '@/dto/agency.dto';

export const getAllAgencies = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const result = await agencyService.getAllAgencies(page, limit);

  const response: ApiResponse<typeof result> = {
    success: true,
    statusCode: 200,
    data: result,
    message: 'Agencies fetched successfully',
  };
  res.status(200).json(response);
};

export const getAgencyById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await agencyService.getAgencyById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Agency fetched successfully',
  };
  res.status(200).json(response);
};

export const createAgency = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const data = await agencyService.createNewAgency(req.body as CreateAgencyDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Agency profile created successfully',
  };
  res.status(201).json(response);
};

export const updateAgency = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const data = await agencyService.updateAgencyById(id, req.body as UpdateAgencyDto, userId, role);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Agency profile updated successfully',
  };
  res.status(200).json(response);
};

export const verifyAgency = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await agencyService.verifyAgencyById(id, req.body as VerifyAgencyDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Agency verification status updated successfully',
  };
  res.status(200).json(response);
};

export const deleteAgency = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  await agencyService.deleteAgencyById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Agency deleted successfully',
  };
  res.status(200).json(response);
};

export const getAgencyAgents = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await agencyService.getAgencyAgents(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Agency agents fetched successfully',
  };
  res.status(200).json(response);
};

export const verifyAgentInAgency = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id, agentId } = req.params;
  const { isVerified } = req.body;
  const data = await agencyService.verifyAgentInAgency(id, agentId, Boolean(isVerified));

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Agent link verification updated successfully',
  };
  res.status(200).json(response);
};
