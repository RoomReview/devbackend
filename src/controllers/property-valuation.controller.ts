import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '@/types';
import * as valuationService from '@/services/property-valuation.service';
import * as creditsService from '@/services/user-credits.service';
import type { CreatePropertyValuationDto } from '@/dto/property-valuation.dto';
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

export const logValuation = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const data = await valuationService.logValuation(userId, req.body as CreatePropertyValuationDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Property valuation completed and credits deducted successfully',
  };
  res.status(201).json(response);
};

export const getValuationById = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await valuationService.getValuationById(id);
  const userCredits = await creditsService.getUserCreditsById(data.userCreditsId);
  validateOwnerOrAdmin(req, userCredits.userId);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Property valuation details fetched successfully',
  };
  res.status(200).json(response);
};

export const getUserValuations = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { userId } = req.params;
  validateOwnerOrAdmin(req, userId);

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const { data, pagination } = await valuationService.getUserValuations(userId, page, limit);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'User property valuations fetched successfully',
  };
  res.status(200).json(response);
};
