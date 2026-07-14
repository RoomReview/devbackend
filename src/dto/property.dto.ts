import {
  PropertyType,
  ListingType,
  PriceFrequency,
  FurnishedType,
  BillsIncluded,
  PropertyStatus,
} from '@/generated/prisma/enums';
import {
  object,
  string,
  number,
  array,
  enum as enum_,
  type infer as _infer,
} from 'zod';

export const CreatePropertyDto = object({
  title: string().min(1),
  description: string().min(1),
  type: enum_([
    PropertyType.FLAT,
    PropertyType.HOUSE,
    PropertyType.ROOM,
    PropertyType.STUDIO,
    PropertyType.MAISONETTE,
    PropertyType.BUNGALOW,
  ]),
  listingType: enum_([
    ListingType.FOR_RENT,
    ListingType.FOR_SALE,
  ]),
  price: number().positive(),
  priceFrequency: enum_([
    PriceFrequency.WEEKLY,
    PriceFrequency.MONTHLY,
    PriceFrequency.YEARLY,
  ]).optional(),
  bedrooms: number().int().nonnegative(),
  bathrooms: number().int().nonnegative(),
  size: number().int().positive().optional(),
  furnished: enum_([
    FurnishedType.FURNISHED,
    FurnishedType.UNFURNISHED,
    FurnishedType.PART_FURNISHED,
  ]).optional(),
  address: string().min(1),
  latitude: number().optional(),
  longitude: number().optional(),
  features: array(string()).optional(),
  availableFrom: string().optional(), // ISO date string
  minTenancy: string().optional(),
  deposit: number().positive().optional(),
  bills: enum_([
    BillsIncluded.INCLUDED,
    BillsIncluded.EXCLUDED,
    BillsIncluded.PARTIAL,
  ]).optional(),
  epcRating: string().optional(),
  floorPlan: string().optional(),
  postcodeId: string().min(1),
});

export type CreatePropertyDto = _infer<typeof CreatePropertyDto>;

export const UpdatePropertyDto = object({
  title: string().min(1).optional(),
  description: string().min(1).optional(),
  type: enum_([
    PropertyType.FLAT,
    PropertyType.HOUSE,
    PropertyType.ROOM,
    PropertyType.STUDIO,
    PropertyType.MAISONETTE,
    PropertyType.BUNGALOW,
  ]).optional(),
  listingType: enum_([
    ListingType.FOR_RENT,
    ListingType.FOR_SALE,
  ]).optional(),
  price: number().positive().optional(),
  priceFrequency: enum_([
    PriceFrequency.WEEKLY,
    PriceFrequency.MONTHLY,
    PriceFrequency.YEARLY,
  ]).optional(),
  bedrooms: number().int().nonnegative().optional(),
  bathrooms: number().int().nonnegative().optional(),
  size: number().int().positive().optional(),
  furnished: enum_([
    FurnishedType.FURNISHED,
    FurnishedType.UNFURNISHED,
    FurnishedType.PART_FURNISHED,
  ]).optional(),
  address: string().min(1).optional(),
  latitude: number().optional(),
  longitude: number().optional(),
  features: array(string()).optional(),
  availableFrom: string().optional(),
  minTenancy: string().optional(),
  deposit: number().positive().optional(),
  bills: enum_([
    BillsIncluded.INCLUDED,
    BillsIncluded.EXCLUDED,
    BillsIncluded.PARTIAL,
  ]).optional(),
  epcRating: string().optional(),
  floorPlan: string().optional(),
  postcodeId: string().min(1).optional(),
  status: enum_([
    PropertyStatus.ACTIVE,
    PropertyStatus.PENDING,
    PropertyStatus.SOLD,
    PropertyStatus.LET,
    PropertyStatus.WITHDRAWN,
  ]).optional(),
});

export type UpdatePropertyDto = _infer<typeof UpdatePropertyDto>;
