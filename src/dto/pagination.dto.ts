import { object, number, preprocess, enum as zEnum, string, type infer as _infer } from 'zod';

export const PaginationQueryDto = object({
  page: preprocess(
    (val) => (val ? Number(val) : undefined),
    number().int().min(1).default(1),
  ),
  limit: preprocess(
    (val) => (val ? Number(val) : undefined),
    number().int().min(1).max(100).default(10),
  ),
}).passthrough();

export type PaginationQueryDto = _infer<typeof PaginationQueryDto>;

export const PostcodeListQueryDto = PaginationQueryDto.extend({
  sortBy: zEnum([
    'alphabetical-asc',
    'alphabetical-desc',
    'crime-asc',
    'crime-desc',
    'price-asc',
    'price-desc',
    'rating-desc',
  ]).optional(),
  outcodePrefix: string().trim().min(1).max(4).optional(),
});

export const OptionalPaginationQueryDto = object({
  page: preprocess(
    (val) => (val ? Number(val) : undefined),
    number().int().min(1).optional(),
  ),
  limit: preprocess(
    (val) => (val ? Number(val) : undefined),
    number().int().min(1).max(100).optional(),
  ),
}).passthrough();

export type OptionalPaginationQueryDto = _infer<typeof OptionalPaginationQueryDto>;
