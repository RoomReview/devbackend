import type { Request, Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '@/types';
import * as experienceService from '@/services/experience.service';
import type { CreateExperienceDto, UpdateExperienceDto, UpdateExperienceStatusDto } from '@/dto/experience.dto';
import { ExperienceType, ExperienceStatus } from '@/generated/prisma/enums';
import { validateAccessToken } from '@/services/auth.service';

export const getAllExperiences = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  
  const filter = {
    type: req.query.type as ExperienceType,
    status: req.query.status as ExperienceStatus,
    postcodeId: req.query.postcodeId as string,
    authorId: req.query.authorId as string,
  };

  const { data, pagination } = await experienceService.getAllExperiences(page, limit, filter);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'Experiences fetched successfully',
  };
  res.status(200).json(response);
};

export const getExperienceById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await experienceService.getExperienceById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Experience fetched successfully',
  };
  res.status(200).json(response);
};

export const createExperience = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  let authorId: string | null = null;

  // Optional authentication: check if token is provided
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const { user } = await validateAccessToken(token);
      authorId = user.userId;
    } catch {
      // Invalid token is ignored for optional auth
    }
  }

  const data = await experienceService.createNewExperience(req.body as CreateExperienceDto, authorId);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Experience submitted successfully',
  };
  res.status(201).json(response);
};

export const updateExperience = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const data = await experienceService.updateExperienceById(id, req.body as UpdateExperienceDto, userId, role);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Experience updated successfully',
  };
  res.status(200).json(response);
};

export const updateExperienceStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await experienceService.updateExperienceStatusById(id, req.body as UpdateExperienceStatusDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Experience status updated successfully',
  };
  res.status(200).json(response);
};

export const deleteExperience = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  await experienceService.deleteExperienceById(id, userId, role);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Experience deleted successfully',
  };
  res.status(200).json(response);
};
