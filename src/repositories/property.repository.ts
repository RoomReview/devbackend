import { PropertySelect, PropertyCreateInput, PropertyUpdateInput } from '@/generated/prisma/models';
import { PropertyType, ListingType, PropertyStatus } from '@/generated/prisma/enums';
import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

const logContext: LogContext = {
  service: 'PropertyRepository',
  function: '',
};

export const createProperty = async (
  property: PropertyCreateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.property.create({ data: property }).catch(err => {
    logContext.function = 'createProperty';
    logger.error(logContext, 'Error in createProperty repository', { error: err });
    throw new Error('DB: property create operation failed');
  });
};

export const findPropertyById = async (propertyId: string, select?: PropertySelect) => {
  return await prisma.property.findUnique({
    where: { propertyId },
    select: select || {
      propertyId: true,
      title: true,
      description: true,
      type: true,
      listingType: true,
      price: true,
      priceFrequency: true,
      bedrooms: true,
      bathrooms: true,
      size: true,
      furnished: true,
      address: true,
      latitude: true,
      longitude: true,
      features: true,
      availableFrom: true,
      minTenancy: true,
      deposit: true,
      bills: true,
      epcRating: true,
      floorPlan: true,
      verified: true,
      featured: true,
      status: true,
      viewCount: true,
      landlordId: true,
      postcodeId: true,
      createdAt: true,
      updatedAt: true,
      images: true,
    },
  }).catch(err => {
    logContext.function = 'findPropertyById';
    logger.error(logContext, 'Error in findPropertyById repository', { error: err });
    throw new Error('DB: findPropertyById operation failed');
  });
};

export interface FindPropertiesFilter {
  type?: PropertyType;
  listingType?: ListingType;
  status?: PropertyStatus;
  postcodeId?: string;
  landlordId?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
}

export const findAllProperties = async (
  limit: number,
  offset: number,
  filter?: FindPropertiesFilter,
  select?: PropertySelect,
) => {
  const where: any = {};
  if (filter?.type) where.type = filter.type;
  if (filter?.listingType) where.listingType = filter.listingType;
  if (filter?.status) where.status = filter.status;
  if (filter?.postcodeId) where.postcodeId = filter.postcodeId;
  if (filter?.landlordId) where.landlordId = filter.landlordId;
  if (filter?.bedrooms !== undefined) where.bedrooms = filter.bedrooms;
  
  if (filter?.minPrice !== undefined || filter?.maxPrice !== undefined) {
    where.price = {};
    if (filter.minPrice !== undefined) where.price.gte = filter.minPrice;
    if (filter.maxPrice !== undefined) where.price.lte = filter.maxPrice;
  }

  return await prisma.property.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    select: select || {
      propertyId: true,
      title: true,
      description: true,
      type: true,
      listingType: true,
      price: true,
      priceFrequency: true,
      bedrooms: true,
      bathrooms: true,
      address: true,
      verified: true,
      featured: true,
      status: true,
      viewCount: true,
      landlordId: true,
      postcodeId: true,
      createdAt: true,
      images: {
        take: 1,
        orderBy: { order: 'asc' },
      },
    },
  }).catch(err => {
    logContext.function = 'findAllProperties';
    logger.error(logContext, 'Error in findAllProperties repository', { error: err });
    throw new Error('DB: findAllProperties operation failed');
  });
};

export const countProperties = async (filter?: FindPropertiesFilter) => {
  const where: any = {};
  if (filter?.type) where.type = filter.type;
  if (filter?.listingType) where.listingType = filter.listingType;
  if (filter?.status) where.status = filter.status;
  if (filter?.postcodeId) where.postcodeId = filter.postcodeId;
  if (filter?.landlordId) where.landlordId = filter.landlordId;
  if (filter?.bedrooms !== undefined) where.bedrooms = filter.bedrooms;

  if (filter?.minPrice !== undefined || filter?.maxPrice !== undefined) {
    where.price = {};
    if (filter.minPrice !== undefined) where.price.gte = filter.minPrice;
    if (filter.maxPrice !== undefined) where.price.lte = filter.maxPrice;
  }

  return await prisma.property.count({ where }).catch(err => {
    logContext.function = 'countProperties';
    logger.error(logContext, 'Error in countProperties repository', { error: err });
    throw new Error('DB: countProperties operation failed');
  });
};

export const updateProperty = async (
  propertyId: string,
  data: PropertyUpdateInput,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.property.update({
    where: { propertyId },
    data,
  }).catch(err => {
    logContext.function = 'updateProperty';
    logger.error(logContext, 'Error in updateProperty repository', { error: err });
    throw new Error('DB: property update operation failed');
  });
};

export const deleteProperty = async (
  propertyId: string,
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  > = prisma,
) => {
  return await tx.property.delete({
    where: { propertyId },
  }).catch(err => {
    logContext.function = 'deleteProperty';
    logger.error(logContext, 'Error in deleteProperty repository', { error: err });
    throw new Error('DB: property delete operation failed');
  });
};

export const incrementPropertyViewCount = async (propertyId: string) => {
  return await prisma.property.update({
    where: { propertyId },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  }).catch(err => {
    logContext.function = 'incrementPropertyViewCount';
    logger.error(logContext, 'Error in incrementPropertyViewCount repository', { error: err });
    // Don't crash request if view count increment fails
  });
};
