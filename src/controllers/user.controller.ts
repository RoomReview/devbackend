import { Request, Response } from 'express';

export const getAllUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({ message: 'Get all users' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Get user by id: ${id}` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(201).json({ message: 'Create user', data: req.body });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Update user: ${id}`, data: req.body });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Delete user: ${id}` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
