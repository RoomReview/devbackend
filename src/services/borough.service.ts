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
  buildCrimeHighlight,
    buildCrimeTrendData,
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

const normalizeBoroughName = (boroughName: string) => {
  const normalizedName = boroughName.trim().toLowerCase();
  if (normalizedName === 'city of westminster') return 'Westminster';
  if (normalizedName === 'barking & dagenham') return 'Barking and Dagenham';
  return boroughName;
};

const mapHousingStockRow = (row: Record<string, unknown>, boroughName: string) => ({
  boroughName: normalizeBoroughName(String(row.borough_name ?? boroughName)),
  year: Number(row.year ?? 0),
  totalDwellings: Number(row.total_dwellings ?? 0),
  netAdditions: Number(row.net_additions ?? 0),
  affordableStarts: Number(row.affordable_starts ?? 0),
  affordableCompletions: Number(row.affordable_completions ?? 0),
  bandD: Number(row.band_d ?? 0),
  bandDRank: row.rank_band_d_lowest == null ? null : Number(row.rank_band_d_lowest),
  affordableFinancialYear: row.affordable_financial_year == null ? null : String(row.affordable_financial_year),
  totalDwellingsRank: row.rank_total_dwellings == null ? null : Number(row.rank_total_dwellings),
  netAdditionsRank: row.rank_net_additions == null ? null : Number(row.rank_net_additions),
});

const getBoroughComparisonData = async (boroughName: string) => {
  const [priceRows, priceHistoryRows, housingRows, educationRows, policeRows] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT DISTINCT ON (borough_name)
        borough_name, avg_price, yoy_growth_pct, quarter_label
      FROM housing_price_quarterly
      WHERE lower(borough_name) <> 'london'
      ORDER BY borough_name, year DESC, quarter DESC
    `,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT borough_name, yoy_growth_pct, quarter_label
      FROM (
        SELECT borough_name, yoy_growth_pct, quarter_label, year, quarter,
          ROW_NUMBER() OVER (PARTITION BY borough_name ORDER BY year DESC, quarter DESC) AS period_rank
        FROM housing_price_quarterly
        WHERE lower(borough_name) <> 'london'
      ) ranked_prices
      WHERE period_rank <= 40
      ORDER BY borough_name, year, quarter
    `,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT DISTINCT ON (borough_name)
        borough_name, year, total_dwellings, net_additions,
        affordable_starts, affordable_completions, affordable_financial_year, band_d,
        rank_total_dwellings, rank_net_additions, rank_band_d_lowest
      FROM housing_stock_annual
      WHERE lower(borough_name) <> 'london'
      ORDER BY borough_name, year DESC
    `,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT DISTINCT ON (borough_name)
        borough_name, total_school_count, education_rank, gcse_attainment_8,
        ks2_expectedstandard_read_write_maths, ofsted_goodand_outstanding
      FROM education_london
      WHERE lower(borough_name) <> 'london'
      ORDER BY borough_name, year DESC
    `,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT DISTINCT ON (borough_name, year)
        borough_name, year, total_crimes_per_1000, total_crimes_annualised,
        safety_rank_total_crimes_per_1000
      FROM police_police
      WHERE lower(borough_name) <> 'london'
      ORDER BY borough_name, year DESC
    `,
  ]);

  const priceGrowthHistoryByBorough = new Map<string, Array<{ period: string; value: number }>>();
  for (const row of priceHistoryRows) {
    if (row.yoy_growth_pct == null) continue;
    const value = Number(row.yoy_growth_pct);
    if (!Number.isFinite(value)) continue;

    const normalizedName = normalizeBoroughName(String(row.borough_name));
    const history = priceGrowthHistoryByBorough.get(normalizedName) ?? [];
    history.push({ period: String(row.quarter_label ?? ''), value });
    priceGrowthHistoryByBorough.set(normalizedName, history);
  }

  return {
    housingPriceComparisonData: priceRows.map((row) => ({
      boroughName: normalizeBoroughName(String(row.borough_name)),
      averagePrice: Number(row.avg_price ?? 0),
      yoyGrowthPct: Number(row.yoy_growth_pct ?? 0),
      period: String(row.quarter_label ?? ''),
      growthHistory: priceGrowthHistoryByBorough.get(normalizeBoroughName(String(row.borough_name))) ?? [],
    })),
    housingStockComparisonData: housingRows.map((row) => mapHousingStockRow(row, boroughName)),
    educationComparisonData: educationRows.map((row) => ({
      boroughName: normalizeBoroughName(String(row.borough_name)),
      totalSchools: Number(row.total_school_count ?? 0),
      educationRank: Number(row.education_rank ?? 0),
      gcseAttainment8: Number(row.gcse_attainment_8 ?? 0),
      ks2ExpectedStandard: Number(row.ks2_expectedstandard_read_write_maths ?? 0),
      ofstedGoodAndOutstanding: Number(row.ofsted_goodand_outstanding ?? 0),
    })),
    policingComparisonData: policeRows.map((row) => ({
      boroughName: normalizeBoroughName(String(row.borough_name)),
      year: Number(row.year ?? 0),
      totalCrimesPer1000: Number(row.total_crimes_per_1000 ?? 0),
      totalCrimesAnnualised: row.total_crimes_annualised == null
        ? null
        : Number(row.total_crimes_annualised),
      safetyRank: row.safety_rank_total_crimes_per_1000 == null
        ? null
        : Number(row.safety_rank_total_crimes_per_1000),
    })),
  };
};

const getLatestBoroughDataset = async <T>(table: BoroughDatasetTable, boroughName: string) => {
  const orderByField = table === 'district_table'
    ? '_built_at'
    : table === 'housing_price_quarterly' || table === 'housing_stock_annual'
      ? '_gold_built_at'
      : table === 'rent_quarterly'
        ? '_transformed_at'
        : 'year';

  const sql = table === 'district_table'
    ? `SELECT district_code, borough_name FROM "district_table" WHERE borough_name = $1 ORDER BY "_built_at" DESC LIMIT 10`
    : table === 'rent_quarterly' || table === 'housing_price_quarterly'
      ? `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY year DESC, quarter DESC LIMIT 40`
      : table === 'housing_stock_annual'
        ? `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY year DESC LIMIT 10`
      : table === 'police_police'
        ? `SELECT * FROM "${table}" WHERE lower(replace(borough_name, '&', 'and')) = lower(replace($1, '&', 'and')) ORDER BY ${orderByField} DESC LIMIT 10`
      : `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY ${orderByField} DESC LIMIT 10`;
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
  const [rentQuarterlyRows, housingPriceRows, policeRows, educationRows, housingStockRows, districtRows, comparisonData] =
    boroughName
      ? await Promise.all([
          getLatestBoroughDataset('rent_quarterly', boroughName),
          getLatestBoroughDataset('housing_price_quarterly', boroughName),
          getLatestBoroughDataset('police_police', boroughName),
          getLatestBoroughDataset('education_london', boroughName),
          getLatestBoroughDataset('housing_stock_annual', boroughName),
          getLatestBoroughDataset('district_table', boroughName),
          getBoroughComparisonData(boroughName),
        ])
      : [[], [], [], [], [], [], {
          housingPriceComparisonData: [],
          housingStockComparisonData: [],
          educationComparisonData: [],
          policingComparisonData: [],
        }];

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
    rentTrendData: rentQuarterlyRowsTyped
      .map((row) => ({ year: Number(row.year), quarter: Number(row.quarter), value: Number(row.rent_all ?? 0) }))
      .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.value) && row.value > 0)
      .reverse(),
    propertyValueData: buildPropertyValueData(housingPriceRowsTyped),
    priceTrendData: housingPriceRowsTyped
      .map((row) => ({ year: Number(row.year), quarter: Number(row.quarter), value: Number(row.avg_price ?? 0) }))
      .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.value) && row.value > 0)
      .reverse(),
    crimeData: buildCrimeData(policeRowsTyped[0] ?? {}),
    crimeTrendData: buildCrimeTrendData(policeRowsTyped),
    crimeHighlight: buildCrimeHighlight(policeRowsTyped[0] ?? {}),
    housingPriceComparisonData: comparisonData.housingPriceComparisonData,
    housingStockComparisonData: comparisonData.housingStockComparisonData,
    housingStockHistory: housingStockRowsTyped.map((row) => mapHousingStockRow(row, boroughName)),
    educationComparisonData: comparisonData.educationComparisonData,
    policingComparisonData: comparisonData.policingComparisonData,
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
