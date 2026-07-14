import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '@/types';
import * as creditService from '@/services/credit-transaction.service';
import * as creditsService from '@/services/user-credits.service';
import type { CreateCreditTransactionDto } from '@/dto/credit-transaction.dto';
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

export const createTransaction = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const body = req.body as CreateCreditTransactionDto;
  const data = await creditService.createCreditTransaction(body);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Credit transaction completed successfully',
  };
  res.status(201).json(response);
};

export const getTransactionById = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await creditService.getTransactionById(id);
  const userCredits = await creditsService.getUserCreditsById(data.userCreditsId);
  validateOwnerOrAdmin(req, userCredits.userId);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Credit transaction details fetched successfully',
  };
  res.status(200).json(response);
};

export const getUserTransactions = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { userId } = req.params;
  validateOwnerOrAdmin(req, userId);

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const { data, pagination } = await creditService.getUserTransactions(userId, page, limit);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'User credit transactions fetched successfully',
  };
  res.status(200).json(response);
};
