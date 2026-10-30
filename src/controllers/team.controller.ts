import type { Response } from 'express';
import type { ApiResponse, AuthenticatedRequest } from '@/types';
import * as teamService from '@/services/team.service';
import { UnauthorizedError } from '@/utils/custom-error';

const authenticatedUserId = (req: AuthenticatedRequest) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError({ message: 'User authorization required' });
  }
  return userId;
};

export const getTeam = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await teamService.getTeam(authenticatedUserId(req));
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data, message: 'Team fetched successfully' };
  res.status(200).json(response);
};

export const createInvitation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await teamService.createTeamInvitation(authenticatedUserId(req), req.body.email);
  const response: ApiResponse<typeof data> = { success: true, statusCode: 201, data, message: 'Invitation sent successfully' };
  res.status(201).json(response);
};

export const getInvitationDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await teamService.getInvitationDetails(req.params.token as string);
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data, message: 'Invitation details fetched successfully' };
  res.status(200).json(response);
};

export const acceptInvitation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await teamService.acceptTeamInvitation(authenticatedUserId(req), req.body.token);
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data, message: 'Invitation accepted successfully' };
  res.status(200).json(response);
};

export const removeMember = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await teamService.removeTeamMember(authenticatedUserId(req), req.params.userId as string);
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data, message: 'Team member removed successfully' };
  res.status(200).json(response);
};

export const revokeInvitation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const data = await teamService.revokeTeamInvitation(authenticatedUserId(req), req.params.invitationId as string);
  const response: ApiResponse<typeof data> = { success: true, statusCode: 200, data, message: 'Invitation revoked successfully' };
  res.status(200).json(response);
};
