import type { Response } from 'express';
import type { ApiResponse, AuthenticatedRequest } from '@/types';
import prisma from '@config/database';

export const getSavedProperties = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, statusCode: 401, error: 'Authentication required' });
      return;
    }

    const data = await prisma.saved_properties.findMany({
      where: { user_id: userId },
      include: { properties: true },
      orderBy: { created_at: 'desc' },
    });

    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 200,
      data,
      message: 'Saved properties fetched successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch saved properties';
    res.status(500).json({ success: false, statusCode: 500, error: message });
  }
};

export const saveProperty = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const propertyId = String(req.params.propertyId ?? req.body.propertyId ?? '');

    if (!userId) {
      res.status(401).json({ success: false, statusCode: 401, error: 'Authentication required' });
      return;
    }

    if (!propertyId) {
      res.status(400).json({ success: false, statusCode: 400, error: 'Property ID is required' });
      return;
    }

    const existing = await prisma.saved_properties.findUnique({
      where: {
        user_id_property_id: {
          user_id: userId,
          property_id: propertyId,
        },
      },
    });

    if (existing) {
      const response: ApiResponse<typeof existing> = {
        success: true,
        statusCode: 200,
        data: existing,
        message: 'Property already saved',
      };
      res.status(200).json(response);
      return;
    }

    const now = new Date();
    const data = await prisma.saved_properties.create({
      data: {
        saved_property_id: crypto.randomUUID(),
        user_id: userId,
        property_id: propertyId,
        created_at: now,
        updated_at: now,
      },
      include: { properties: true },
    });

    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 201,
      data,
      message: 'Property saved successfully',
    };
    res.status(201).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save property';
    res.status(400).json({ success: false, statusCode: 400, error: message });
  }
};

export const removeSavedProperty = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const propertyId = String(req.params.propertyId ?? '');

    if (!userId) {
      res.status(401).json({ success: false, statusCode: 401, error: 'Authentication required' });
      return;
    }

    const record = await prisma.saved_properties.findUnique({
      where: {
        user_id_property_id: {
          user_id: userId,
          property_id: propertyId,
        },
      },
    });

    if (!record) {
      res.status(404).json({ success: false, statusCode: 404, error: 'Saved property not found' });
      return;
    }

    await prisma.saved_properties.delete({
      where: {
        user_id_property_id: {
          user_id: userId,
          property_id: propertyId,
        },
      },
    });

    const response: ApiResponse<null> = {
      success: true,
      statusCode: 200,
      data: null,
      message: 'Property removed from saved list successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to remove saved property';
    res.status(400).json({ success: false, statusCode: 400, error: message });
  }
};
