import { UserCreateInput, UserSelect } from '@/generated/prisma/models';
import * as userDal from '@/repositories/users.repository';
import { PaginateArgs } from '@/types';
import { ChangePasswordDto } from '@/dto/user.dto';
import { EntityNotFoundError, UnauthorizedError } from '@/utils/custom-error';
import { comparePassword, hashPassword } from '@/utils/password';
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

export const findAllUsers = async (data: PaginateArgs) => {
  const { page, limit } = data;
  const { offset } = await paginate(page, limit);
  const users = await userDal.findAllUsers(limit, offset);
  return { users };
};

export const findUserById = async (
  id: string,
  selectFields?: UserSelect,
): Promise<User | null> => {
  return (await userDal.findUserById(
    id,
    selectFields || defaultSelectFields,
  )) as User | null;
};

export const getUserSensitiveById = async (id: string) => {
  defaultSelectFields.passwordHash = true;
  return await userDal.findUserById(id, defaultSelectFields);
};

export const updateUserPassword = async (id: string, passwordHash: string) => {
  return await userDal.updateUserPassword(id, passwordHash);
};

export const updateUserPasswordAndClearCode = async (
  id: string,
  passwordHash: string,
) => {
  return await userDal.updateUserPasswordAndClearCode(id, passwordHash);
};

export const changePassword = async (id: string, data: ChangePasswordDto) => {
  const user = await getUserSensitiveById(id);
  if (!user) {
    throw new EntityNotFoundError({
      message: 'User not found',
      code: 'ENTITY_NOT_FOUND',
    });
  }

  if (!(await comparePassword(data.oldPassword, user.passwordHash))) {
    throw new UnauthorizedError({
      message: 'Invalid old password',
      code: 'VALIDATION_ERROR',
    });
  }

  const newPasswordHash = await hashPassword(data.newPassword);
  await updateUserPassword(id, newPasswordHash);

  // TODO: send password change confirmation email

  return { success: true };
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
