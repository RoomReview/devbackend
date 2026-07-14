import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '@/types';
import * as propertyImageService from '@/services/property-image.service';
import type { CreatePropertyImageDto, UpdatePropertyImageDto } from '@/dto/property-image.dto';

export const getImagesByPropertyId = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { propertyId } = req.params as any;
  const data = await propertyImageService.getImagesByPropertyId(propertyId);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Property images fetched successfully',
  };
  res.status(200).json(response);
};

export const createImage = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { propertyId } = req.params as any;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const data = await propertyImageService.createImage(propertyId, req.body as CreatePropertyImageDto, userId, role);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Property image created successfully',
  };
  res.status(201).json(response);
};

export const updateImage = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { imageId } = req.params as any;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const data = await propertyImageService.updateImage(imageId, req.body as UpdatePropertyImageDto, userId, role);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Property image updated successfully',
  };
  res.status(200).json(response);
};

export const deleteImage = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { imageId } = req.params as any;
  const userId = req.user!.userId;
  const role = req.user!.role;
  await propertyImageService.deleteImage(imageId, userId, role);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Property image deleted successfully',
  };
  res.status(200).json(response);
};
