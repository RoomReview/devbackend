import { findPostcodeByCode } from '@/repositories/postcode.repository';
import { findBoroughById } from '@/repositories/borough.repository';
import { findAllData } from '@/repositories/data.repository';
import { EntityNotFoundError } from '@/utils/custom-error';
import type { DataTable } from '@/repositories/data.repository';
import { normalizePostcodeCode } from '@/utils/postcode';
import prisma from '@config/database';

const getPostcodeFilter = (code: string) => ({ postcode: code });

const getLatestData = async (table: DataTable, filters: Record<string, unknown>) => {
  return await findAllData(table, 10, 0, filters);
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

export const buildRentData = (rows: Array<Record<string, unknown>>) => {
  const latest = rows[0] as Record<string, unknown> | undefined;
  if (!latest) return [];

  return [
    { rent: Number(latest.rent_all ?? 0), type: 'average' },
    { rent: Number(latest.rent_one_bed ?? 0), type: '1-bed' },
    { rent: Number(latest.rent_two_bed ?? 0), type: '2-bed' },
    { rent: Number(latest.rent_three_bed ?? 0), type: '3-bed' },
    { rent: Number(latest.rent_four_plus_bed ?? 0), type: '4+-bed' },
  ].filter((item) => item.rent > 0);
};

export const buildCrimeData = (row: Record<string, unknown> = {}) => {
  const metrics = [
    ['Total crimes per 1,000', row.total_crimes_per_1000],
    ['Violent crime', row.violent_crime_per_1000],
    ['Burglary', row.burglary_per_1000],
    ['Anti-social behaviour', row.anti_social_behaviour_per_1000],
  ];

  return metrics
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([label, value]) => ({ label, value: Number(value), crime_rate: Number(value) }));
};

export const buildPropertyValueData = (rows: Array<Record<string, unknown>>) => {
  const latest = rows[0] as Record<string, unknown> | undefined;
  if (!latest) return [];

  return [
    { label: 'Average price', value: Number(latest.avg_price ?? 0) },
    { label: 'YoY growth', value: Number(latest.yoy_growth_pct ?? 0) },
  ];
};

export const buildDemographyData = (rows: Array<Record<string, unknown>>) => {
  return rows.map((row) => ({
    age_group: String(row.age_group ?? row.label ?? 'Unknown'),
    percentage: Number(row.percentage ?? 0),
  }));
};

export const buildEducationData = (rows: Array<Record<string, unknown>>) => {
  const latest = rows[0] as Record<string, unknown> | undefined;
  if (!latest) return [];

  return [
    { label: 'Total schools', value: Number(latest.total_school_count ?? 0) },
    { label: 'GCSE attainment 8', value: Number(latest.gcse_attainment_8 ?? 0) },
    { label: 'Strong pass English & maths', value: Number(latest.strong_pass_eng_maths ?? 0) },
    { label: 'Ofsted good/outstanding', value: Number(latest.ofsted_goodand_outstanding ?? 0) },
    { label: 'Education rank', value: Number(latest.education_rank ?? 0) },
  ];
};

export const buildHousingStockData = (rows: Array<Record<string, unknown>>) => {
  const latest = rows[0] as Record<string, unknown> | undefined;
  if (!latest) return [];

  return [
    { label: 'Total dwellings', value: Number(latest.total_dwellings ?? 0) },
    { label: 'Net additions', value: Number(latest.net_additions ?? 0) },
    { label: 'Affordable starts', value: Number(latest.affordable_starts ?? 0) },
    { label: 'Affordable completions', value: Number(latest.affordable_completions ?? 0) },
    { label: 'Band D', value: Number(latest.band_d ?? 0) },
  ];
};

export const buildDistrictData = (rows: Array<Record<string, unknown>>) => {
  const latest = rows[0] as Record<string, unknown> | undefined;
  if (!latest) return [];

  return [
    {
      districtCode: String(latest.district_code ?? ''),
      boroughName: String(latest.borough_name ?? ''),
    },
  ];
};

export const getPostcodeDataByCode = async (code: string) => {
  const normalizedCode = normalizePostcodeCode(code);
  const postcode = await findPostcodeByCode(normalizedCode);

  if (!postcode) {
    throw new EntityNotFoundError({
      message: `Postcode with code ${code} not found`,
      code: 'ENTITY_NOT_FOUND',
      data: {
        attemptedCode: normalizedCode,
        note: 'No postcode record matched the requested code.',
      },
    });
  }

  const borough = postcode.boroughId
    ? await findBoroughById(postcode.boroughId)
    : null;

  const boroughName = borough?.name;

  const [demography, propertyValueData, rentData, crimeData, votingData, rentQuarterlyRows, housingPriceRows, policeRows, educationRows, housingStockRows, districtRows] =
    await Promise.all([
      getLatestData('demography', getPostcodeFilter(normalizedCode)),
      getLatestData('property_value_data', getPostcodeFilter(normalizedCode)),
      getLatestData('rent_data', getPostcodeFilter(normalizedCode)),
      boroughName
        ? getLatestData('crime_data', { borough: boroughName })
        : Promise.resolve([]),
      boroughName
        ? getLatestData('voting_data', { borough: boroughName })
        : Promise.resolve([]),
      boroughName ? getLatestBoroughDataset('rent_quarterly', boroughName) : Promise.resolve([]),
      boroughName ? getLatestBoroughDataset('housing_price_quarterly', boroughName) : Promise.resolve([]),
      boroughName ? getLatestBoroughDataset('police_police', boroughName) : Promise.resolve([]),
      boroughName ? getLatestBoroughDataset('education_london', boroughName) : Promise.resolve([]),
      boroughName ? getLatestBoroughDataset('housing_stock_annual', boroughName) : Promise.resolve([]),
      boroughName ? getLatestBoroughDataset('district_table', boroughName) : Promise.resolve([]),
    ]);

  const rentDataRows = Array.isArray(rentData) ? (rentData as Array<Record<string, unknown>>) : [];
  const propertyValueRows = Array.isArray(propertyValueData) ? (propertyValueData as Array<Record<string, unknown>>) : [];
  const crimeRows = Array.isArray(crimeData) ? (crimeData as Array<Record<string, unknown>>) : [];
  const demographyRows = Array.isArray(demography) ? (demography as Array<Record<string, unknown>>) : [];
  const rentQuarterlyRowsTyped = Array.isArray(rentQuarterlyRows) ? (rentQuarterlyRows as Array<Record<string, unknown>>) : [];
  const housingPriceRowsTyped = Array.isArray(housingPriceRows) ? (housingPriceRows as Array<Record<string, unknown>>) : [];
  const policeRowsTyped = Array.isArray(policeRows) ? (policeRows as Array<Record<string, unknown>>) : [];
  const educationRowsTyped = Array.isArray(educationRows) ? (educationRows as Array<Record<string, unknown>>) : [];
  const housingStockRowsTyped = Array.isArray(housingStockRows) ? (housingStockRows as Array<Record<string, unknown>>) : [];
  const districtRowsTyped = Array.isArray(districtRows) ? (districtRows as Array<Record<string, unknown>>) : [];

  const mappedRentData = rentDataRows.length > 0
    ? rentDataRows.map((row) => ({ rent: Number((row as any).rent ?? 0), type: String((row as any).property_type ?? 'average') }))
    : buildRentData(rentQuarterlyRowsTyped);

  const mappedPropertyValueData = propertyValueRows.length > 0
    ? propertyValueRows.map((row) => ({ label: 'Latest value', value: Number((row as any).value ?? 0) }))
    : buildPropertyValueData(housingPriceRowsTyped);

  const mappedCrimeData = crimeRows.length > 0
    ? crimeRows.map((row) => ({
        label: String((row as any).crime_type ?? 'Crime'),
        crime_rate: Number((row as any).crime_rate ?? 0),
        value: Number((row as any).crime_rate ?? 0),
      }))
    : buildCrimeData(policeRowsTyped[0] ?? {});

  const mappedDemography = demographyRows.length > 0
    ? demographyRows.map((row) => ({
        age_group: String((row as any).age_group ?? 'Unknown'),
        percentage: Number((row as any).percentage ?? 0),
      }))
    : buildDemographyData(demographyRows);

  return {
    postcode,
    borough: borough ?? null,
    crimeData: mappedCrimeData,
    demography: mappedDemography,
    propertyValueData: mappedPropertyValueData,
    rentData: mappedRentData,
    votingData,
    educationData: buildEducationData(educationRowsTyped),
    housingStockData: buildHousingStockData(housingStockRowsTyped),
    districtData: buildDistrictData(districtRowsTyped),
  };
};
