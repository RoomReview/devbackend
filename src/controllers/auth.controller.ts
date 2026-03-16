import type { Request, Response } from 'express';
import { loginUser, registerUser, logoutUser, resetEmailVerification, verifyEmail, refreshAccessToken } from '@/services/auth.service';
import { ApiResponse } from '@/types';
import logger, { LogContext } from '@/utils/logger';
import { VerifyEmailCodeDto } from '@/dto/auth.dto';

const logContext: LogContext = {
  service: 'AuthController',
  function: '',
};
export const register = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { user, session, isExistingUser } = await registerUser(req.body);
    console.log('user', user, isExistingUser);
    const resultant: ApiResponse<{
      user: typeof user;
      session: typeof session;
    }> = {
      success: true,
      statusCode: isExistingUser ? 202 : 201,
      message: isExistingUser
        ? 'User already exists'
        : 'User registered successfully',
      data: {
        user,
        session,
      },
    };
    return res.status(resultant.statusCode).json(resultant);
  } catch (error) {
    logContext.function = 'register';
    logger.error(logContext, 'Error in register controller', { error });
    throw error;
  }
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { session, user } = await loginUser(
      req.body.email,
      req.body.password,
    );
    const resultant: ApiResponse<{
      user: typeof user;
      session: typeof session;
    }> = {
      success: session ? true : false,
      statusCode: session ? 200 : 401,
      message: session ? 'User logged in successfully' : 'Invalid credentials',
      data: session ? {
        user,
        session,
      } : undefined,
    };
    return res.status(resultant.statusCode).json(resultant);
  } catch (error) {
    logContext.function = 'login';
    logger.error(logContext, 'Error in login controller', { error });
    throw error;
  }
};

export const logout = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const result = await logoutUser(req.body?.userId);
    const resultant: ApiResponse<null> = {
      success: !!result,
      statusCode: result ? 200 : 400,
      message: result ? 'User logged out successfully' : 'Logout failed',
      data: null,
    };
    return res.status(resultant.statusCode).json(resultant);
  } catch (error) {
    logContext.function = 'logout';
    logger.error(logContext, 'Error in logout controller', { error });
    throw error;
  }
};

export const emailVerifyReset = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { isNewCodeGenerated } = await resetEmailVerification(req.body.email);
    const resultant: ApiResponse<{ isNewCodeGenerated: boolean }> = {
      success: true,
      statusCode: 201,
      message: 'Verification code sent successfully',
      data: { isNewCodeGenerated },
    };
    return res.status(201).json(resultant);
  } catch (error) {
    logContext.function = 'emailVerifyReset';
    logger.error(logContext, 'Error in emailVerifyReset controller', { error });
    throw error;
  }
};

export const emailVerify = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    console.log('entered here', req.query)
    const { user } = await verifyEmail((req?.query as VerifyEmailCodeDto));
    const resultant: ApiResponse<{ user: typeof user }> = {
      success: true,
      statusCode: 200,
      message: 'Email verified successfully',
      data: { user },
    };
    return res.status(200).json(resultant);
  } catch (error) {
    logContext.function = 'emailVerify';
    logger.error(logContext, 'Error in emailVerify controller', { error });
    throw error;
  }
};

export const refresh = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const { userId, refreshToken } = req.body as { userId: string; refreshToken: string };
    const { accessToken, expiresAt } = await refreshAccessToken(userId, refreshToken);
    const resultant: ApiResponse<{ accessToken: string; expiresAt: Date | undefined }> = {
      success: true,
      statusCode: 200,
      message: 'Access token refreshed successfully',
      data: { accessToken, expiresAt },
    };
    return res.status(200).json(resultant);
  } catch (error) {
    logContext.function = 'refresh';
    logger.error(logContext, 'Error in refresh controller', { error });
    throw error;
  }
};
