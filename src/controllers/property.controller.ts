import type { Response } from 'express';
import type { AuthenticatedRequest, ApiResponse } from '@/types';
import * as propertyService from '@/services/property.service';
import type { CreatePropertyDto, UpdatePropertyDto } from '@/dto/property.dto';
import { PropertyType, ListingType, PropertyStatus } from '@/generated/prisma/enums';

export const getAllProperties = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const filter = {
    type: req.query.type as PropertyType,
    listingType: req.query.listingType as ListingType,
    status: req.query.status as PropertyStatus,
    postcodeId: req.query.postcodeId as string,
    landlordId: req.query.landlordId as string,
    minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
    bedrooms: req.query.bedrooms ? Number(req.query.bedrooms) : undefined,
  };

  const paginatedResult = await propertyService.getAllProperties(page, limit, filter);

  const response: ApiResponse<typeof paginatedResult> = {
    success: true,
    statusCode: 200,
    data: paginatedResult,
    message: 'Properties fetched successfully',
  };
  res.status(200).json(response);
};

export const getPropertyById = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await propertyService.getPropertyById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Property fetched successfully',
  };
  res.status(200).json(response);
};

export const createProperty = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const landlordId = req.user!.userId;
  const data = await propertyService.createNewProperty(req.body as CreatePropertyDto, landlordId);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Property created successfully',
  };
  res.status(201).json(response);
};

export const updateProperty = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  const data = await propertyService.updatePropertyById(id, req.body as UpdatePropertyDto, userId, role);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Property updated successfully',
  };
  res.status(200).json(response);
};

export const deleteProperty = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.userId;
  const role = req.user!.role;
  await propertyService.deletePropertyById(id, userId, role);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Property deleted successfully',
  };
  res.status(200).json(response);
};
