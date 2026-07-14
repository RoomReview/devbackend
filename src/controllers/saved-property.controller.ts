import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '@/types';
import * as savedPropertyService from '@/services/saved-property.service';
import type { SavePropertyDto } from '@/dto/saved-property.dto';

export const getSavedProperties = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const userId = req.user!.userId;

  const { data, pagination } = await savedPropertyService.getSavedPropertiesByUser(userId, page, limit);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'Saved properties fetched successfully',
  };
  res.status(200).json(response);
};

export const saveProperty = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { propertyId } = req.body as SavePropertyDto;

  const data = await savedPropertyService.savePropertyForUser(userId, propertyId);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Property saved successfully',
  };
  res.status(201).json(response);
};

export const unsaveProperty = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const userId = req.user!.userId;
  const { propertyId } = req.params;

  await savedPropertyService.unsavePropertyForUser(userId, propertyId);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Property unsaved successfully',
  };
  res.status(200).json(response);
};
