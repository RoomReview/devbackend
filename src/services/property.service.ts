import prisma from '@config/database';

export interface Property {
  property_id: string;
  title: string;
  description: string;
  type: 'FLAT' | 'HOUSE' | 'ROOM' | 'STUDIO' | 'MAISONETTE' | 'BUNGALOW' | string;
  listing_type: 'FOR_RENT' | 'FOR_SALE' | string;
  price: number | string;
  price_frequency?: 'WEEKLY' | 'MONTHLY' | 'YEARLY' | string;
  bedrooms: number;
  bathrooms: number;
  size?: number | null;
  furnished?: 'FURNISHED' | 'UNFURNISHED' | 'PART_FURNISHED' | string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  features?: string[];
  available_from?: Date | null;
  min_tenancy?: string | null;
  deposit?: number | string | null;
  bills?: 'INCLUDED' | 'EXCLUDED' | 'PARTIAL' | string;
  epc_rating?: string | null;
  floor_plan?: string | null;
  verified?: boolean;
  featured?: boolean;
  status?: 'ACTIVE' | 'PENDING' | 'SOLD' | 'LET' | 'WITHDRAWN' | string;
  view_count?: number;
  landlord_id: string;
  postcode_id: string;
  created_at: Date;
  updated_at: Date;
}

const propertyStore = new Map<string, Property>();

const toNumber = (value: number | string | null | undefined) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const findAllProperties = async (): Promise<Property[]> => {
  try {
    const rows = await (prisma as any).properties.findMany({
      orderBy: { created_at: 'desc' },
    });
    return rows as Property[];
  } catch {
    return Array.from(propertyStore.values());
  }
};

export const findPropertyById = async (id: string): Promise<Property | null> => {
  try {
    const row = await (prisma as any).properties.findUnique({
      where: { property_id: id },
    });
    return row as Property | null;
  } catch {
    return propertyStore.get(id) ?? null;
  }
};

export const findPropertyOwnerId = async (id: string): Promise<string | null> => {
  const property = await prisma.properties.findUnique({
    where: { property_id: id },
    select: { landlord_id: true },
  });
  return property?.landlord_id ?? null;
};

export const findPropertiesByPostcode = async (postcode: string): Promise<Property[]> => {
  try {
    const rows = await (prisma as any).properties.findMany({
      where: { postcode_id: postcode },
      orderBy: { created_at: 'desc' },
    });
    return rows as Property[];
  } catch {
    return Array.from(propertyStore.values()).filter((property) => property.postcode_id === postcode);
  }
};

export const createProperty = async (data: Partial<Property>): Promise<Property> => {
  const now = new Date();
  const property: Property = {
    property_id: data.property_id ?? crypto.randomUUID(),
    title: data.title ?? 'Untitled property',
    description: data.description ?? '',
    type: data.type ?? 'FLAT',
    listing_type: data.listing_type ?? 'FOR_RENT',
    price: toNumber(data.price) ?? 0,
    price_frequency: data.price_frequency ?? 'MONTHLY',
    bedrooms: Number(data.bedrooms ?? 0),
    bathrooms: Number(data.bathrooms ?? 0),
    size: data.size ?? null,
    furnished: data.furnished ?? 'UNFURNISHED',
    address: data.address ?? '',
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    features: data.features ?? [],
    available_from: data.available_from ?? null,
    min_tenancy: data.min_tenancy ?? null,
    deposit: data.deposit ?? null,
    bills: data.bills ?? 'EXCLUDED',
    epc_rating: data.epc_rating ?? null,
    floor_plan: data.floor_plan ?? null,
    verified: data.verified ?? false,
    featured: data.featured ?? false,
    status: data.status ?? 'ACTIVE',
    view_count: data.view_count ?? 0,
    landlord_id: data.landlord_id ?? '00000000-0000-4000-8000-000000000000',
    postcode_id: data.postcode_id ?? '00000000-0000-4000-8000-000000000000',
    created_at: now,
    updated_at: now,
  };

  try {
    const saved = await (prisma as any).properties.create({ data: property });
    propertyStore.set(saved.property_id, saved as Property);
    return saved as Property;
  } catch {
    propertyStore.set(property.property_id, property);
    return property;
  }
};

export const updateProperty = async (id: string, data: Partial<Property>): Promise<Property | null> => {
  const existing = await findPropertyById(id);
  if (!existing) return null;

  const next = { ...existing, ...data, updated_at: new Date() };

  try {
    const updated = await (prisma as any).properties.update({
      where: { property_id: id },
      data: next,
    });
    propertyStore.set(id, updated as Property);
    return updated as Property;
  } catch {
    propertyStore.set(id, next);
    return next;
  }
};

export const deleteProperty = async (id: string): Promise<boolean> => {
  try {
    await (prisma as any).properties.delete({ where: { property_id: id } });
    propertyStore.delete(id);
    return true;
  } catch {
    return propertyStore.delete(id);
  }
};
