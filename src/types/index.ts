import type { Request } from 'express';
import type { ZodType } from 'zod';

export interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user?: {
    userId: string;
    email: string;
    role: string;
    accessTokenId?: string;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  data?: T;
  message?: string;
  error?: string;
  status?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  };
}

export interface ValidateRequestMiddlewareArgs<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
> {
  body?: ZodType<TBody>;
  params?: ZodType<TParams>;
  query?: ZodType<TQuery>;
}

export interface PaginateArgs {
  page: number;
  limit: number;
}

