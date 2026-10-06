import type { Request, Response } from 'express';
import { CreatePropertyDto, UpdatePropertyDto } from '@/dto/property.dto';
import type { ApiResponse, AuthenticatedRequest } from '@/types';
import {
  createProperty as createPropertyService,
  deleteProperty as deletePropertyService,
  findAllProperties,
  findPropertyById,
  findPropertyOwnerId,
  updateProperty as updatePropertyService,
  type Property,
} from '@/services/property.service';

const canManageProperty = (
  req: AuthenticatedRequest,
  res: Response,
  ownerId: string,
): boolean => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ success: false, statusCode: 401, error: 'Authentication is required' });
    return false;
  }
  if (!['ADMIN', 'LANDLORD', 'AGENCY', 'AGENT'].includes(user.role)) {
    res.status(403).json({ success: false, statusCode: 403, error: 'Insufficient permissions' });
    return false;
  }
  if (user.role !== 'ADMIN' && user.userId !== ownerId) {
    res.status(404).json({ success: false, statusCode: 404, error: 'Property not found' });
    return false;
  }
  return true;
};

export const getAllProperties = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await findAllProperties();
    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 200,
      data,
      message: 'Properties fetched successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ success: false, statusCode: 500, error: message });
  }
};

export const getPropertyById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = String(req.params.id ?? '');
    const data = await findPropertyById(id);
    if (!data) {
      res.status(404).json({ success: false, statusCode: 404, error: 'Property not found' });
      return;
    }

    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 200,
      data,
      message: 'Property fetched successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ success: false, statusCode: 500, error: message });
  }
};

export const createProperty = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ success: false, statusCode: 401, error: 'Authentication is required' });
      return;
    }
    const input = CreatePropertyDto.parse(req.body);
    const data = await createPropertyService({
      ...input,
      available_from: input.available_from ? new Date(input.available_from) : null,
      landlord_id: req.user.userId,
    });
    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 201,
      data,
      message: 'Property created successfully',
    };
    res.status(201).json(response);
  } catch (_error) {
    res.status(500).json({ success: false, statusCode: 500, error: 'Unable to create property' });
  }
};

export const updateProperty = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = String(req.params.id ?? '');
    const ownerId = await findPropertyOwnerId(id);
    if (!ownerId) {
      res.status(404).json({ success: false, statusCode: 404, error: 'Property not found' });
      return;
    }
    if (!canManageProperty(req, res, ownerId)) {
      return;
    }
    const input = UpdatePropertyDto.parse(req.body);
    const { available_from, ...propertyFields } = input;
    const updateData: Partial<Property> = propertyFields;
    if (available_from !== undefined) {
      updateData.available_from = available_from ? new Date(available_from) : null;
    }
    const data = await updatePropertyService(id, updateData);
    if (!data) {
      res.status(404).json({ success: false, statusCode: 404, error: 'Property not found' });
      return;
    }

    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 200,
      data,
      message: 'Property updated successfully',
    };
    res.status(200).json(response);
  } catch (_error) {
    res.status(500).json({ success: false, statusCode: 500, error: 'Unable to update property' });
  }
};

export const deleteProperty = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = String(req.params.id ?? '');
    const ownerId = await findPropertyOwnerId(id);
    if (!ownerId) {
      res.status(404).json({ success: false, statusCode: 404, error: 'Property not found' });
      return;
    }
    if (!canManageProperty(req, res, ownerId)) {
      return;
    }
    const deleted = await deletePropertyService(id);
    const response: ApiResponse<null> = {
      success: deleted,
      statusCode: deleted ? 200 : 404,
      data: null,
      message: deleted ? 'Property deleted successfully' : 'Property not found',
    };
    res.status(response.statusCode).json(response);
  } catch (_error) {
    res.status(500).json({ success: false, statusCode: 500, error: 'Unable to delete property' });
  }
};
