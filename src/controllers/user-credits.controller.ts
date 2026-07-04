import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '@/types';
import * as creditsService from '@/services/user-credits.service';
import type { UpdateUserCreditsDto } from '@/dto/user-credits.dto';
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

export const getUserCredits = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { userId } = req.params;
  validateOwnerOrAdmin(req, userId);

  const data = await creditsService.getUserCreditsByUserId(userId);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'User credits details fetched successfully',
  };
  res.status(200).json(response);
};

export const updateUserCredits = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { userId } = req.params;
  const data = await creditsService.updateUserCreditsByUserId(userId, req.body as UpdateUserCreditsDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'User credits updated successfully',
  };
  res.status(200).json(response);
};
