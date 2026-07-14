import {
  createPropertyImage,
  findPropertyImageById,
  findPropertyImagesByPropertyId,
  updatePropertyImage,
  deletePropertyImage,
} from '@/repositories/property-image.repository';
import { findPropertyById } from '@/repositories/property.repository';
import { EntityNotFoundError, ForbiddenError } from '@/utils/custom-error';
import type { CreatePropertyImageDto, UpdatePropertyImageDto } from '@/dto/property-image.dto';
import { UserRole } from '@/generated/prisma/enums';

export const getImagesByPropertyId = async (propertyId: string) => {
  const property = await findPropertyById(propertyId);
  if (!property) {
    throw new EntityNotFoundError({
      message: `Property with ID ${propertyId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return await findPropertyImagesByPropertyId(propertyId);
};

export const createImage = async (
  propertyId: string,
  data: CreatePropertyImageDto,
  userId: string,
  userRole: string,
) => {
  const property = await findPropertyById(propertyId);
  if (!property) {
    throw new EntityNotFoundError({
      message: `Property with ID ${propertyId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  // Authorization check: Only landlord of the property or ADMIN
  if (property.landlordId !== userId && userRole !== UserRole.ADMIN) {
    throw new ForbiddenError({
      message: 'You are not authorized to add images to this property',
      code: 'VALIDATION_ERROR',
    });
  }

  return await createPropertyImage({
    url: data.url,
    alt: data.alt,
    order: data.order ?? 0,
    property: { connect: { propertyId } },
  });
};

export const updateImage = async (
  propertyImageId: string,
  data: UpdatePropertyImageDto,
  userId: string,
  userRole: string,
) => {
  const image = await findPropertyImageById(propertyImageId);
  if (!image) {
    throw new EntityNotFoundError({
      message: `Property image with ID ${propertyImageId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  const property = await findPropertyById(image.propertyId);
  if (!property) {
    throw new EntityNotFoundError({
      message: `Associated property with ID ${image.propertyId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  // Authorization check: Only landlord of the property or ADMIN
  if (property.landlordId !== userId && userRole !== UserRole.ADMIN) {
    throw new ForbiddenError({
      message: 'You are not authorized to update this property image',
      code: 'VALIDATION_ERROR',
    });
  }

  return await updatePropertyImage(propertyImageId, {
    alt: data.alt,
    order: data.order,
  });
};

export const deleteImage = async (
  propertyImageId: string,
  userId: string,
  userRole: string,
) => {
  const image = await findPropertyImageById(propertyImageId);
  if (!image) {
    throw new EntityNotFoundError({
      message: `Property image with ID ${propertyImageId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  const property = await findPropertyById(image.propertyId);
  if (!property) {
    throw new EntityNotFoundError({
      message: `Associated property with ID ${image.propertyId} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  // Authorization check: Only landlord of the property or ADMIN
  if (property.landlordId !== userId && userRole !== UserRole.ADMIN) {
    throw new ForbiddenError({
      message: 'You are not authorized to delete this property image',
      code: 'VALIDATION_ERROR',
    });
  }

  return await deletePropertyImage(propertyImageId);
};
