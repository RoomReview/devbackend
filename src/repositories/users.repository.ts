import { UserSelect, UserCreateInput } from '@/generated/prisma/models';
import prisma from '@config/database';

export const createUser = async (user: UserCreateInput) => {
  return await prisma.user.create({ data: user });
};

export const findUserByEmail = async (email: string, select?: UserSelect) => {
  return await prisma.user.findUnique({ where: { email }, select });
};

export const findUserByVerifyCodeHash = async (email: string, hashedCode: string) => {
  return await prisma.user.findFirst({
    where: { verifyCodeHash: hashedCode, email },
    select: {
      userId: true,
      email: true,
      isEmailVerified: true,
      verifyCodeHash: true,
      verifyCodeExpiry: true,
    },
  });
};

export const updateUserVerifyCode = async (
  email: string,
  verifyCodeHash: string,
  verifyCodeExpiry: Date,
) => {
  return await prisma.user.update({
    where: { email },
    data: { verifyCodeHash, verifyCodeExpiry },
    select: { userId: true, email: true, isEmailVerified: true },
  });
};

export const verifyUserEmail = async (email: string) => {
  return await prisma.user.update({
    where: { email },
    data: {
      isEmailVerified: true,
      verifiedAt: new Date(),
      verifyCodeHash: null,
      verifyCodeExpiry: null,
    },
    select: {
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      isEmailVerified: true,
      verifiedAt: true,
      role: true,
    },
  });
};

export const findAllUsers = async (limit:number, offset:number) => {
  return await prisma.user.findMany({
    take: limit,
    skip: offset,
    select: {
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      isEmailVerified: true,
      isActive: true,
      role: true,
      createdAt: true,
    },
  });
};

export const findUserById = async (userId: string, select?: UserSelect) => {
  return await prisma.user.findUnique({ where: { userId }, select });
};

export const updateUserPassword = async (userId: string, passwordHash: string) => {
  return await prisma.user.update({
    where: { userId },
    data: { passwordHash },
  });
};

export const updateUserPasswordAndClearCode = async (userId: string, passwordHash: string) => {
  return await prisma.user.update({
    where: { userId },
    data: { 
      passwordHash,
      verifyCodeHash: null,
      verifyCodeExpiry: null
    },
  });
};