import { findAllUsers, changePassword as changePasswordService } from '@/services/user.service';
import { ApiResponse } from '@/types';
import type { Request, Response } from 'express';

export const getAllUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { users } = await findAllUsers({ page: Number(page), limit: Number(limit) });
    const resultant: ApiResponse<{ users: typeof users }> = {
      message: 'Get all users',
      data: { users },
      statusCode: 200,
      success: true,
    };

    res.status(resultant.statusCode).json(resultant);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Get user by id: ${id}` });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    res.status(201).json({ message: 'Create user', data: req.body });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Update user: ${id}`, data: req.body });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Delete user: ${id}` });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const activateUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ message: `Activate user: ${id}` });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { userId } = req.params;
  await changePasswordService(userId as string, req.body);
  const resultant: ApiResponse<null> = {
    message: 'Password changed successfully',
    data: null,
    statusCode: 200,
    success: true,
  };
  res.status(200).json(resultant);
};
