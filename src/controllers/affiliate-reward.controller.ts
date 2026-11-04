import type { Response } from 'express';
import type { ApiResponse, AuthenticatedRequest } from '@/types';
import {
  CreateAffiliateOfferDto,
  RedeemReviewRewardDto,
} from '@/dto/affiliate-reward.dto';
import {
  createAffiliateOffer,
  getMyRewards,
  listAffiliateOffersForAdmin,
  redeemReviewReward,
  updateAffiliateOffer,
} from '@/services/affiliate-reward.service';
import { UnauthorizedError, ValidationError } from '@/utils/custom-error';
import {
  SyncAwinOffersDto,
  SyncAwinTransactionsDto,
} from '@/dto/awin-transaction.dto';
import {
  listAdminAwinTransactions,
  listAwinPublisherAccounts,
  syncAwinTransactions,
} from '@/services/awin-transaction.service';
import { syncAwinOffers } from '@/services/awin-offer.service';

const requireUserId = (req: AuthenticatedRequest): string => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError({ message: 'Authentication is required' });
  }
  return userId;
};

export const getRewardsProfile = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const data = await getMyRewards(requireUserId(req));
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Rewards and profile progress fetched successfully',
  };
  res.status(200).json(response);
};

export const redeemReward = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = requireUserId(req);
  const rewardGrantId = String(req.params.rewardGrantId ?? '');
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      rewardGrantId,
    )
  ) {
    throw new ValidationError({
      message: 'A valid reward ID is required',
      code: 'VALIDATION_ERROR',
    });
  }
  const { offerId } = RedeemReviewRewardDto.parse(req.body);
  const data = await redeemReviewReward(userId, rewardGrantId, offerId);
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Reward redeemed successfully',
  };
  res.status(200).json(response);
};

export const getAdminOffers = async (
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const data = await listAffiliateOffersForAdmin();
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Partner offers fetched successfully',
  };
  res.status(200).json(response);
};

export const createAdminOffer = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const offer = CreateAffiliateOfferDto.parse(req.body);
  const data = await createAffiliateOffer(offer);
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Partner offer created successfully',
  };
  res.status(201).json(response);
};

export const updateAdminOffer = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const offerId = String(req.params.offerId ?? '');
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      offerId,
    )
  ) {
    throw new ValidationError({
      message: 'A valid offer ID is required',
      code: 'VALIDATION_ERROR',
    });
  }
  const offer = CreateAffiliateOfferDto.parse(req.body);
  const data = await updateAffiliateOffer(offerId, offer);
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Partner offer updated successfully',
  };
  res.status(200).json(response);
};

export const getAwinPublishers = async (
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const data = await listAwinPublisherAccounts();
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Awin publisher accounts fetched successfully',
  };
  res.status(200).json(response);
};

export const syncAwinTransactionsForAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const input = SyncAwinTransactionsDto.parse(req.body);
  const startDate = new Date(`${input.startDate}T00:00:00.000Z`);
  const endDate = new Date(`${input.endDate}T23:59:59.000Z`);
  const data = await syncAwinTransactions(
    input.publisherId,
    startDate,
    endDate,
    input.dateType,
  );
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Awin transactions synchronized successfully',
  };
  res.status(200).json(response);
};

export const syncAwinOffersForAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { publisherId } = SyncAwinOffersDto.parse(req.body);
  const data = await syncAwinOffers(publisherId);
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Awin offers synchronized successfully',
  };
  res.status(200).json(response);
};

export const getAwinTransactionsForAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const requestedLimit = Number(req.query.limit) || 100;
  const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 500);
  const data = await listAdminAwinTransactions(limit);
  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Awin transactions fetched successfully',
  };
  res.status(200).json(response);
};
