import { ReviewStatus } from '@/generated/prisma/enums';
import {
  object,
  string,
  number,
  boolean,
  array,
  enum as enum_,
  type infer as _infer,
} from 'zod';

export const CreateReviewDto = object({
  title: string().min(1),
  content: string().min(1),
  safetyRating: number().int().min(1).max(5),
  transportRating: number().int().min(1).max(5),
  amenitiesRating: number().int().min(1).max(5),
  valueRating: number().int().min(1).max(5),
  pros: array(string()),
  cons: array(string()),
  yearsLived: number().int().min(0).optional(),
  anonymous: boolean().optional(),
  postcodeId: string().optional(),
  boroughId: string().optional(),
});

export type CreateReviewDto = _infer<typeof CreateReviewDto>;

export const UpdateReviewDto = object({
  title: string().min(1).optional(),
  content: string().min(1).optional(),
  safetyRating: number().int().min(1).max(5).optional(),
  transportRating: number().int().min(1).max(5).optional(),
  amenitiesRating: number().int().min(1).max(5).optional(),
  valueRating: number().int().min(1).max(5).optional(),
  pros: array(string()).optional(),
  cons: array(string()).optional(),
  yearsLived: number().int().min(0).optional(),
  anonymous: boolean().optional(),
  postcodeId: string().optional(),
  boroughId: string().optional(),
});

export type UpdateReviewDto = _infer<typeof UpdateReviewDto>;

export const UpdateReviewStatusDto = object({
  status: enum_([
    ReviewStatus.PENDING,
    ReviewStatus.APPROVED,
    ReviewStatus.REJECTED,
  ]),
  rejectionReason: string().optional(),
});

export type UpdateReviewStatusDto = _infer<typeof UpdateReviewStatusDto>;
