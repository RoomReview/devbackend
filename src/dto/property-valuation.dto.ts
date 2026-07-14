import { PropertyCondition } from '@/generated/prisma/enums';
import {
  object,
  string,
  number,
  enum as enum_,
  type infer as _infer,
} from 'zod';

export const CreatePropertyValuationDto = object({
  postcode: string().min(1),
  propertyType: string().min(1),
  bedrooms: number().int().positive(),
  bathrooms: number().int().positive(),
  floorArea: number().int().positive().optional(),
  yearBuilt: number().int().positive().optional(),
  condition: enum_([
    PropertyCondition.NEW_BUILD,
    PropertyCondition.EXCELLENT,
    PropertyCondition.GOOD,
    PropertyCondition.AVERAGE,
    PropertyCondition.NEEDS_WORK,
    PropertyCondition.RENOVATION_REQUIRED,
  ]),
  creditsUsed: number().int().nonnegative(),
});

export type CreatePropertyValuationDto = _infer<typeof CreatePropertyValuationDto>;
