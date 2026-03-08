import type { Request, Response } from 'express';

export const getAllProperties = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    res.status(200).json({ message: 'Get all properties' });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPropertyById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Get property by id: ${id}` });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProperty = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    res.status(201).json({ message: 'Create property', data: req.body });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProperty = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Update property: ${id}`, data: req.body });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProperty = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Delete property: ${id}` });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};
