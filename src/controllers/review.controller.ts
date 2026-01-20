import { Request, Response } from 'express';

export const getAllReviews = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({ message: 'Get all reviews' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getReviewById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Get review by id: ${id}` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createReview = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(201).json({ message: 'Create review', data: req.body });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Update review: ${id}`, data: req.body });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Delete review: ${id}` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
