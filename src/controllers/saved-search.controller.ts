import type { Response } from 'express';
import type { ApiResponse, AuthenticatedRequest } from '@/types';
import prisma from '@config/database';

const normalizePostcode = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const compact = value.trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) {
    return null;
  }
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
};

export const listSavedSearches = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, statusCode: 401, error: 'Authentication required' });
    return;
  }

  try {
    const data = await prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 200,
      data,
      message: 'Saved searches fetched successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch saved searches';
    res.status(500).json({ success: false, statusCode: 500, error: message });
  }
};

export const saveSearch = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, statusCode: 401, error: 'Authentication required' });
    return;
  }

  const postcode = normalizePostcode(req.body?.postcode);
  if (!postcode) {
    res.status(400).json({ success: false, statusCode: 400, error: 'Enter a valid UK postcode' });
    return;
  }

  try {
    const data = await prisma.savedSearch.upsert({
      where: { userId_postcode: { userId, postcode } },
      create: { userId, postcode },
      update: {},
    });
    const response: ApiResponse<typeof data> = {
      success: true,
      statusCode: 200,
      data,
      message: 'Postcode saved successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save postcode';
    res.status(500).json({ success: false, statusCode: 500, error: message });
  }
};

export const removeSavedSearch = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, statusCode: 401, error: 'Authentication required' });
    return;
  }

  const savedSearchId = String(req.params.savedSearchId ?? '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedSearchId)) {
    res.status(400).json({ success: false, statusCode: 400, error: 'A valid saved search ID is required' });
    return;
  }

  try {
    const result = await prisma.savedSearch.deleteMany({ where: { savedSearchId, userId } });
    if (result.count === 0) {
      res.status(404).json({ success: false, statusCode: 404, error: 'Saved search not found' });
      return;
    }

    const response: ApiResponse<null> = {
      success: true,
      statusCode: 200,
      data: null,
      message: 'Saved search removed successfully',
    };
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to remove saved search';
    res.status(500).json({ success: false, statusCode: 500, error: message });
  }
};
