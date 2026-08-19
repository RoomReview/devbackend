import { UserCreateInput, UserSelect } from '@/generated/prisma/models';
import * as userDal from '@/repositories/users.repository';
import { PaginateArgs } from '@/types';
import { ChangePasswordDto } from '@/dto/user.dto';
import { EntityNotFoundError, UnauthorizedError } from '@/utils/custom-error';
import { comparePassword, hashPassword } from '@/utils/password';
import { paginate } from '@/utils/helpers';
import prisma from '@config/database';
import { UserRole } from '@/generated/prisma/enums';
import {
  createAgency,
  createUserAgency,
} from '@/repositories/agencies.repository';
import { RegisterUserDto } from '@/dto/auth.dto';

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
  const { offset } = paginate(page, limit);
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
  const selectFields: UserSelect = { ...defaultSelectFields, passwordHash: true };
  return await userDal.findUserById(id, selectFields);
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

  if (!(await comparePassword(data.oldPassword, user.passwordHash ?? ''))) {
    throw new UnauthorizedError({
      message: 'Invalid old password',
      code: 'VALIDATION_ERROR',
    });
  }

  const newPasswordHash = await hashPassword(data.newPassword);
  await updateUserPassword(id, newPasswordHash);


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
  const selectFields: UserSelect = { ...defaultSelectFields, passwordHash: true };
  const user = await userDal.findUserByEmail(email, selectFields);
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

export const registerUser = async (
  data: RegisterUserDto,
  hashedPassword: string,
  token: { expiresAt: Date; hashedCode: string },
) => {
  return await prisma.$transaction(async (tx) => {
    const newUser = await userDal.createUser(
      {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        verifyCodeExpiry: token.expiresAt,
        verifyCodeHash: token.hashedCode,
        passwordHash: hashedPassword,
        isEmailVerified: false,
        isActive: true,
        role: data.role as any,
      },
      tx,
    );

    if (data.role === UserRole.AGENCY || data.role === UserRole.AGENT) {
      const agency = await createAgency(
        {
          name: data.agencyName!,
          description: data.agencyDescription,
          email: data.agencyEmail,
          phone: data.agencyPhone,
          website: data.agencyWebsite,
        },
        tx,
      );

      await createUserAgency(
        {
          userId: newUser.userId,
          agencyId: agency.agencyId,
          isVerified: false,
        },
        tx,
      );
    }

    return newUser;
  });
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
