import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '@/types';
import * as aiService from '@/services/ai-interaction.service';
import * as creditsService from '@/services/user-credits.service';
import type { CreateAIInteractionDto } from '@/dto/ai-interaction.dto';
import { UserRole } from '@/generated/prisma/enums';
import { ForbiddenError } from '@/utils/custom-error';

const validateOwnerOrAdmin = (req: AuthenticatedRequest, targetUserId: string) => {
  if (req.user!.userId !== targetUserId && req.user!.role !== UserRole.ADMIN) {
    throw new ForbiddenError({
      message: 'You are not authorized to access this resource',
      code: 'VALIDATION_ERROR',
    });
  }
};

export const logInteraction = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const data = await aiService.logInteraction(userId, req.body as CreateAIInteractionDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'AI interaction logged successfully',
  };
  res.status(201).json(response);
};

export const getInteractionById = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  const data = await aiService.getInteractionById(id);
  const userCredits = await creditsService.getUserCreditsById(data.userCreditsId);
  validateOwnerOrAdmin(req, userCredits.userId);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'AI interaction details fetched successfully',
  };
  res.status(200).json(response);
};

export const getUserInteractions = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { userId } = req.params as any;
  validateOwnerOrAdmin(req, userId);

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const { data, pagination } = await aiService.getUserInteractions(userId, page, limit);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'User AI interactions fetched successfully',
  };
  res.status(200).json(response);
};
