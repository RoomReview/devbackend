import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '@/types';
import * as downloadService from '@/services/download-history.service';
import * as creditsService from '@/services/user-credits.service';
import type { CreateDownloadHistoryDto } from '@/dto/download-history.dto';
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

export const logDownload = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const data = await downloadService.logDownload(userId, req.body as CreateDownloadHistoryDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Download logged and credits deducted successfully',
  };
  res.status(201).json(response);
};

export const getDownloadById = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await downloadService.getDownloadById(id);
  const userCredits = await creditsService.getUserCreditsById(data.userCreditsId);
  validateOwnerOrAdmin(req, userCredits.userId);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Download details fetched successfully',
  };
  res.status(200).json(response);
};

export const getUserDownloads = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { userId } = req.params;
  validateOwnerOrAdmin(req, userId);

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const { data, pagination } = await downloadService.getUserDownloads(userId, page, limit);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'User downloads fetched successfully',
  };
  res.status(200).json(response);
};
