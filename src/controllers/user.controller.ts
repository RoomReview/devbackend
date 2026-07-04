import * as userService from '@/services/user.service';
import { ApiResponse } from '@/types';
import type { Request, Response } from 'express';
import type { UpdateUserProfileDto } from '@/dto/update-user.dto';
import { UserSelect } from '@/generated/prisma/models';
import { EntityNotFoundError } from '@/utils/custom-error';

const defaultSelectFields: UserSelect = {
  userId: true,
  firstName: true,
  lastName: true,
  isEmailVerified: true,
  isActive: true,
  email: true,
  role: true,
  phone: true,
  avatar: true,
  bio: true,
};

export const getAllUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  
  const { users } = await userService.findAllUsers({
    page,
    limit,
  });

  const response: ApiResponse<{ users: typeof users }> = {
    success: true,
    statusCode: 200,
    data: { users },
    message: 'Users fetched successfully',
  };
  res.status(200).json(response);
};

export const getUserById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const user = await userService.findUserById(id, defaultSelectFields);
  if (!user) {
    throw new EntityNotFoundError({
      message: 'User not found',
      code: 'ENTITY_NOT_FOUND',
    });
  }

  const response: ApiResponse<typeof user> = {
    success: true,
    statusCode: 200,
    data: user,
    message: 'User fetched successfully',
  };
  res.status(200).json(response);
};

export const createUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const user = await userService.createUser(req.body);

  const response: ApiResponse<typeof user> = {
    success: true,
    statusCode: 201,
    data: user,
    message: 'User created successfully',
  };
  res.status(201).json(response);
};

export const updateUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const updatedUser = await userService.updateUser(id, req.body as UpdateUserProfileDto);

  const response: ApiResponse<typeof updatedUser> = {
    success: true,
    statusCode: 200,
    data: updatedUser,
    message: 'User updated successfully',
  };
  res.status(200).json(response);
};

export const deleteUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  await userService.deleteUser(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'User deleted successfully',
  };
  res.status(200).json(response);
};

export const activateUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  // Activate user by setting isActive = true
  const updatedUser = await userService.updateUser(id, { isActive: true } as any);

  const response: ApiResponse<typeof updatedUser> = {
    success: true,
    statusCode: 200,
    data: updatedUser,
    message: 'User activated successfully',
  };
  res.status(200).json(response);
};

export const changePassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { userId } = req.params;
  await userService.changePassword(userId as string, req.body);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    data: null,
    message: 'Password changed successfully',
  };
  res.status(200).json(response);
};
