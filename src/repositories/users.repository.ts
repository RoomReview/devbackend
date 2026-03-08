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