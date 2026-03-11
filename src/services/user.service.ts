import { UserCreateInput, UserSelect } from '@/generated/prisma/models';
import * as userDal from '@/repositories/users.repository';
import { PaginateArgs } from '@/types';
import { paginate } from '@/utils/helpers';

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}
const defaultSelectFields: UserSelect = {
  userId: true,
  firstName: true,
  lastName: true,
  isEmailVerified: true,
  isActive: true,
  email: true,
  role: true,
};

export const findAllUsers = async (
  data: PaginateArgs,
) => {
  const { page, limit } = data;
  const { offset } = await paginate(page, limit);
  const users = await userDal.findAllUsers(limit, offset);
  return { users };
};

export const findUserById = async (id: string): Promise<User | null> => {
  // TODO: Implement with Prisma
  console.log(`Finding user: ${id}`);
  return null;
};

export const findUserByEmail = async (
  email: string,
  selectFields?: UserSelect,
) => {
  return await userDal.findUserByEmail(
    email,
    selectFields || defaultSelectFields,
  );
};

export const getUserSensitiveByEmail = async (email: string) => {
  defaultSelectFields.passwordHash = true;
  const user = await userDal.findUserByEmail(email, defaultSelectFields);
  return user;
};

export const createUser = async (
  data: UserCreateInput,
  isReturnSensitive = false,
) => {
  const user = await userDal.createUser(data);
  if (isReturnSensitive) {
    return user;
  }
  const { passwordHash, verifyCodeHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const updateUser = async (
  id: string,
  data: Partial<User>,
): Promise<User | null> => {
  // TODO: Implement with Prisma
  console.log(`Updating user: ${id}`, data);
  return null;
};

export const deleteUser = async (id: string): Promise<boolean> => {
  // TODO: Implement with Prisma
  console.log(`Deleting user: ${id}`);
  return true;
};
