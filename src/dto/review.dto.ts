import { array, boolean, number, object, string } from 'zod';

export const UpdateReviewDto = object({
  title: string().trim().min(1).max(200).optional(),
  content: string().trim().min(1).max(10_000).optional(),
  safety_rating: number().int().min(1).max(5).optional(),
  transport_rating: number().int().min(1).max(5).optional(),
  amenities_rating: number().int().min(1).max(5).optional(),
  value_rating: number().int().min(1).max(5).optional(),
  pros: array(string().max(1000)).max(50).optional(),
  cons: array(string().max(1000)).max(50).optional(),
  years_lived: number().int().min(0).max(100).nullable().optional(),
  anonymous: boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one review field is required');
