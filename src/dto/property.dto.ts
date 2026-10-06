import {
  array,
  enum as enum_,
  number,
  object,
  string,
} from 'zod';

const propertyFields = {
  title: string().trim().min(1).max(200),
  description: string().max(10_000),
  type: enum_(['FLAT', 'HOUSE', 'ROOM', 'STUDIO', 'MAISONETTE', 'BUNGALOW']),
  listing_type: enum_(['FOR_RENT', 'FOR_SALE']),
  price: number().positive().max(100_000_000),
  price_frequency: enum_(['WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  bedrooms: number().int().min(0).max(50),
  bathrooms: number().int().min(0).max(50),
  size: number().int().min(1).max(1_000_000).nullable().optional(),
  furnished: enum_(['FURNISHED', 'UNFURNISHED', 'PART_FURNISHED']).optional(),
  address: string().trim().min(1).max(500),
  latitude: number().min(-90).max(90).nullable().optional(),
  longitude: number().min(-180).max(180).nullable().optional(),
  features: array(string().max(200)).max(100).optional(),
  available_from: string().datetime().nullable().optional(),
  min_tenancy: string().max(100).nullable().optional(),
  deposit: number().nonnegative().max(100_000_000).nullable().optional(),
  bills: enum_(['INCLUDED', 'EXCLUDED', 'PARTIAL']).optional(),
  epc_rating: string().max(20).nullable().optional(),
  floor_plan: string().max(2000).nullable().optional(),
  postcode_id: string().trim().min(1).max(100),
};

export const CreatePropertyDto = object(propertyFields).strict();

export const UpdatePropertyDto = object({
  ...propertyFields,
  title: propertyFields.title.optional(),
  description: propertyFields.description.optional(),
  type: propertyFields.type.optional(),
  listing_type: propertyFields.listing_type.optional(),
  price: propertyFields.price.optional(),
  bedrooms: propertyFields.bedrooms.optional(),
  bathrooms: propertyFields.bathrooms.optional(),
  address: propertyFields.address.optional(),
  postcode_id: propertyFields.postcode_id.optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one property field is required');
