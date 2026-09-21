import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import {
  createProperty as createPropertyService,
  deleteProperty as deletePropertyService,
  findAllProperties,
  findPropertyById,
  updateProperty as updatePropertyService,
} from '@/services/property.service';

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
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await createPropertyService(req.body);
    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 201,
      data,
      message: 'Property created successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create property';
    res.status(400).json({ success: false, statusCode: 400, error: message });
  }
};

export const updateProperty = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = String(req.params.id ?? '');
    const data = await updatePropertyService(id, req.body);
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update property';
    res.status(400).json({ success: false, statusCode: 400, error: message });
  }
};

export const deleteProperty = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = String(req.params.id ?? '');
    const deleted = await deletePropertyService(id);
    const response: ApiResponse<null> = {
      success: deleted,
      statusCode: deleted ? 200 : 404,
      data: null,
      message: deleted ? 'Property deleted successfully' : 'Property not found',
    };
    res.status(response.statusCode).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete property';
    res.status(400).json({ success: false, statusCode: 400, error: message });
  }
};
