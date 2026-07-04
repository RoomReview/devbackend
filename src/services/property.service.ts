import {
  createProperty,
  findPropertyById,
  findAllProperties,
  countProperties,
  updateProperty,
  deleteProperty,
  incrementPropertyViewCount,
  FindPropertiesFilter,
} from '@/repositories/property.repository';
import { EntityNotFoundError, ForbiddenError, ValidationError } from '@/utils/custom-error';
import type { CreatePropertyDto, UpdatePropertyDto } from '@/dto/property.dto';
import { paginate, buildPaginatedResult } from '@/utils/helpers';
import { PropertyStatus, UserRole } from '@/generated/prisma/enums';
import { findPostcodeById } from '@/repositories/postcode.repository';

export const getAllProperties = async (page: number, limit: number, filter?: FindPropertiesFilter) => {
  const { offset } = paginate(page, limit);
  const [properties, total] = await Promise.all([
    findAllProperties(limit, offset, filter),
    countProperties(filter),
  ]);
  return buildPaginatedResult(properties, total, page, limit);
};

export const getPropertyById = async (id: string) => {
  const property = await findPropertyById(id);
  if (!property) {
    throw new EntityNotFoundError({
      message: `Property with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  // Increment view count asynchronously
  incrementPropertyViewCount(id);

  return property;
};

export const createNewProperty = async (data: CreatePropertyDto, landlordId: string) => {
  const postcode = await findPostcodeById(data.postcodeId);
  if (!postcode) {
    throw new ValidationError({
      message: `Postcode with ID ${data.postcodeId} does not exist`,
      code: 'VALIDATION_ERROR',
    });
  }

  return await createProperty({
    title: data.title,
    description: data.description,
    type: data.type,
    listingType: data.listingType,
    price: data.price,
    priceFrequency: data.priceFrequency,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    size: data.size,
    furnished: data.furnished,
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    features: data.features,
    availableFrom: data.availableFrom ? new Date(data.availableFrom) : undefined,
    minTenancy: data.minTenancy,
    deposit: data.deposit,
    bills: data.bills,
    epcRating: data.epcRating,
    floorPlan: data.floorPlan,
    verified: false,
    featured: false,
    status: PropertyStatus.ACTIVE,
    landlord: { connect: { userId: landlordId } },
    postcode: { connect: { postcodeId: data.postcodeId } },
  });
};

export const updatePropertyById = async (
  id: string,
  data: UpdatePropertyDto,
  userId: string,
  userRole: string,
) => {
  const existing = await findPropertyById(id);
  if (!existing) {
    throw new EntityNotFoundError({
      message: `Property with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  // Authorization check: Only landlord or ADMIN can update
  if (existing.landlordId !== userId && userRole !== UserRole.ADMIN) {
    throw new ForbiddenError({
      message: 'You are not authorized to update this property',
      code: 'VALIDATION_ERROR',
    });
  }

  if (data.postcodeId) {
    const postcode = await findPostcodeById(data.postcodeId);
    if (!postcode) {
      throw new ValidationError({
        message: `Postcode with ID ${data.postcodeId} does not exist`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  return await updateProperty(id, {
    title: data.title,
    description: data.description,
    type: data.type,
    listingType: data.listingType,
    price: data.price,
    priceFrequency: data.priceFrequency,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    size: data.size,
    furnished: data.furnished,
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    features: data.features,
    availableFrom: data.availableFrom ? new Date(data.availableFrom) : undefined,
    minTenancy: data.minTenancy,
    deposit: data.deposit,
    bills: data.bills,
    epcRating: data.epcRating,
    floorPlan: data.floorPlan,
    status: data.status,
    ...(data.postcodeId ? { postcode: { connect: { postcodeId: data.postcodeId } } } : {}),
  });
};

export const deletePropertyById = async (id: string, userId: string, userRole: string) => {
  const existing = await findPropertyById(id);
  if (!existing) {
    throw new EntityNotFoundError({
      message: `Property with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  // Authorization check: Only landlord or ADMIN can delete
  if (existing.landlordId !== userId && userRole !== UserRole.ADMIN) {
    throw new ForbiddenError({
      message: 'You are not authorized to delete this property',
      code: 'VALIDATION_ERROR',
    });
  }

  return await deleteProperty(id);
};
