import {
  saveProperty,
  findSavedProperty,
  findSavedPropertiesByUserId,
  countSavedPropertiesByUserId,
  deleteSavedProperty,
} from '@/repositories/saved-property.repository';
import { findPropertyById } from '@/repositories/property.repository';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import { paginate } from '@/utils/helpers';

export const getSavedPropertiesByUser = async (userId: string, page: number, limit: number) => {
  const { offset } = paginate(page, limit);
  const items = await findSavedPropertiesByUserId(userId, limit, offset);
  const total = await countSavedPropertiesByUserId(userId);
  const totalPages = Math.ceil(total / limit);

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

export const savePropertyForUser = async (userId: string, propertyId: string) => {
  // Guard: Validate property exists
  const property = await findPropertyById(propertyId);
  if (!property) {
    throw new EntityNotFoundError({
      message: `Property with ID ${propertyId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  // Guard: Avoid duplicates
  const existing = await findSavedProperty(userId, propertyId);
  if (existing) {
    throw new ValidationError({
      message: 'Property is already saved',
      code: 'VALIDATION_ERROR',
    });
  }

  return await saveProperty(userId, propertyId);
};

export const unsavePropertyForUser = async (userId: string, propertyId: string) => {
  const existing = await findSavedProperty(userId, propertyId);
  if (!existing) {
    throw new EntityNotFoundError({
      message: 'Saved property record not found',
      code: 'ENTITY_NOT_FOUND',
    });
  }

  return await deleteSavedProperty(userId, propertyId);
};
