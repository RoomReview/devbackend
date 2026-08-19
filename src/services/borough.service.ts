import {
  createBorough,
  findBoroughById,
  findBoroughBySlug,
  findAllBoroughs,
  countBoroughs,
  updateBorough,
  deleteBorough,
} from '@/repositories/borough.repository';
import {
  buildCrimeData,
  buildDistrictData,
  buildEducationData,
  buildHousingStockData,
  buildPropertyValueData,
  buildRentData,
} from '@/services/postcode-data.service';
import prisma from '@config/database';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import type { CreateBoroughDto, UpdateBoroughDto } from '@/dto/borough.dto';
import { paginate, buildPaginatedResult } from '@/utils/helpers';

export const getAllBoroughs = async (page: number, limit: number) => {
  const { offset } = paginate(page, limit);
  const [boroughs, total] = await Promise.all([
    findAllBoroughs(limit, offset),
    countBoroughs(),
  ]);
  return buildPaginatedResult(boroughs, total, page, limit);
};

type BoroughDatasetTable = 'district_table' | 'education_london' | 'rent_quarterly' | 'housing_price_quarterly' | 'housing_stock_annual' | 'police_police';

const getLatestBoroughDataset = async <T>(table: BoroughDatasetTable, boroughName: string) => {
  const orderByField = table === 'district_table'
    ? '_built_at'
    : table === 'housing_price_quarterly' || table === 'housing_stock_annual'
      ? '_gold_built_at'
      : table === 'rent_quarterly'
        ? '_transformed_at'
        : 'year';

  const sql = `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY ${orderByField} DESC LIMIT 10`;
  return (await prisma.$queryRawUnsafe(sql, boroughName)) as T[];
};

export const getBoroughById = async (id: string) => {
  const borough = await findBoroughById(id);
  if (!borough) {
    throw new EntityNotFoundError({
      message: `Borough with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }

  const boroughName = borough.name;
  const [rentQuarterlyRows, housingPriceRows, policeRows, educationRows, housingStockRows, districtRows] =
    boroughName
      ? await Promise.all([
          getLatestBoroughDataset('rent_quarterly', boroughName),
          getLatestBoroughDataset('housing_price_quarterly', boroughName),
          getLatestBoroughDataset('police_police', boroughName),
          getLatestBoroughDataset('education_london', boroughName),
          getLatestBoroughDataset('housing_stock_annual', boroughName),
          getLatestBoroughDataset('district_table', boroughName),
        ])
      : [[], [], [], [], [], []];

  const rentQuarterlyRowsTyped = Array.isArray(rentQuarterlyRows) ? (rentQuarterlyRows as Array<Record<string, unknown>>) : [];
  const housingPriceRowsTyped = Array.isArray(housingPriceRows) ? (housingPriceRows as Array<Record<string, unknown>>) : [];
  const policeRowsTyped = Array.isArray(policeRows) ? (policeRows as Array<Record<string, unknown>>) : [];
  const educationRowsTyped = Array.isArray(educationRows) ? (educationRows as Array<Record<string, unknown>>) : [];
  const housingStockRowsTyped = Array.isArray(housingStockRows) ? (housingStockRows as Array<Record<string, unknown>>) : [];
  const districtRowsTyped = Array.isArray(districtRows) ? (districtRows as Array<Record<string, unknown>>) : [];

  return {
    ...borough,
    educationData: buildEducationData(educationRowsTyped),
    housingStockData: buildHousingStockData(housingStockRowsTyped),
    districtData: buildDistrictData(districtRowsTyped),
    rentData: buildRentData(rentQuarterlyRowsTyped),
    propertyValueData: buildPropertyValueData(housingPriceRowsTyped),
    crimeData: buildCrimeData(policeRowsTyped[0] ?? {}),
  };
};

export const getBoroughBySlug = async (slug: string) => {
  const borough = await findBoroughBySlug(slug);
  if (!borough) {
    throw new EntityNotFoundError({
      message: `Borough with slug ${slug} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return borough;
};

export const createNewBorough = async (data: CreateBoroughDto) => {
  const existingSlug = await findBoroughBySlug(data.slug);
  if (existingSlug) {
    throw new ValidationError({
      message: `Borough with slug ${data.slug} already exists`,
      code: 'VALIDATION_ERROR',
    });
  }

  return await createBorough({
    name: data.name,
    slug: data.slug,
    description: data.description,
    image: data.image,
    latitude: data.latitude,
    longitude: data.longitude,
    metrics: data.metrics || {},
  });
};

export const updateBoroughById = async (id: string, data: UpdateBoroughDto) => {
  await getBoroughById(id);

  if (data.slug) {
    const existingSlug = await findBoroughBySlug(data.slug);
    if (existingSlug && existingSlug.boroughId !== id) {
      throw new ValidationError({
        message: `Borough with slug ${data.slug} already exists`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  return await updateBorough(id, {
    name: data.name,
    slug: data.slug,
    description: data.description,
    image: data.image,
    latitude: data.latitude,
    longitude: data.longitude,
    metrics: data.metrics,
  });
};

export const deleteBoroughById = async (id: string) => {
  await getBoroughById(id);
  return await deleteBorough(id);
};
