import { findPostcodeByCode } from '@/repositories/postcode.repository';
import { findBoroughById } from '@/repositories/borough.repository';
import { findAllData } from '@/repositories/data.repository';
import { EntityNotFoundError } from '@/utils/custom-error';
import type { DataTable } from '@/repositories/data.repository';
import { getPostcodeLookupCandidates, normalizePostcodeCode } from '@/utils/postcode';
import { getSignedSpacesObjectUrl } from '@/services/spaces-assets.service';
import prisma from '@config/database';

const getPostcodeFilter = (code: string) => ({ postcode: code });

const getLatestData = async (table: DataTable, filters: Record<string, unknown>) => {
  return await findAllData(table, 10, 0, filters);
};

const getLsoaDemographicsForPostcode = async (code: string) => {
  const [postcodeCandidate, alternateCandidate] = getPostcodeLookupCandidates(code);
  return await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT allocation.allocation_weight AS "allocationWeight", demographics.*
    FROM postcode_lsoa_allocations AS allocation
    JOIN lsoa_demographics AS demographics ON demographics.lsoa21cd = allocation.lsoa_code
    WHERE allocation.postcode = ${postcodeCandidate}
      OR allocation.postcode = ${alternateCandidate ?? postcodeCandidate}
  `;
};

const getLsoaTransportForPostcode = async (code: string) => {
  const [postcodeCandidate, alternateCandidate] = getPostcodeLookupCandidates(code);
  const allocations = await prisma.$queryRaw<Array<{ lsoaCode: string }>>`
    SELECT allocation.lsoa_code AS "lsoaCode"
    FROM postcode_lsoa_allocations AS allocation
    WHERE (allocation.postcode = ${postcodeCandidate}
      OR allocation.postcode = ${alternateCandidate ?? postcodeCandidate})
      AND allocation.is_primary = TRUE
    LIMIT 1
  `;
  const lsoaCode = allocations[0]?.lsoaCode;
  if (!lsoaCode) return null;

  const [busRoutes, stations] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        route.rank,
        route.route_short_name AS "routeShortName",
        route.destination_label AS "destinationLabel",
        route.agency_name AS "agencyName",
        route.is_night AS "isNight",
        route.trips_in_area AS "tripsInArea",
        route.nearest_stop_name AS "nearestStopName",
        route.nearest_stop_m AS "nearestStopM"
      FROM gold_lsoa_nearby_buses AS route
      WHERE route.lsoa_code = ${lsoaCode}
      ORDER BY route.rank
    `,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        station.station_name AS name,
        station.distance_m AS "distanceM",
        station.walk_minutes_est AS "walkMinutesEstimate"
      FROM gold_lsoa_nearby_station AS station
      WHERE station.lsoa_code = ${lsoaCode}
      LIMIT 1
    `,
  ]);

  return { lsoaCode, busRoutes, nearestStation: stations[0] ?? null };
};

const getLsoaMapForPostcode = async (code: string) => {
  const [postcodeCandidate, alternateCandidate] = getPostcodeLookupCandidates(code);
  const rows = await prisma.$queryRaw<Array<{
    filename: string;
    mapVersion: string;
    imageWidthPx: number;
    imageHeightPx: number;
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
  }>>`
    SELECT
      bounds.filename,
      bounds.map_version AS "mapVersion",
      bounds.image_width_px AS "imageWidthPx",
      bounds.image_height_px AS "imageHeightPx",
      bounds.min_lon AS "minLon",
      bounds.max_lon AS "maxLon",
      bounds.min_lat AS "minLat",
      bounds.max_lat AS "maxLat"
    FROM postcode_lsoa_allocations AS allocation
    JOIN lsoa_map_bounds AS bounds ON bounds.lsoa_code = allocation.lsoa_code
    WHERE (allocation.postcode = ${postcodeCandidate}
      OR allocation.postcode = ${alternateCandidate ?? postcodeCandidate})
      AND allocation.is_primary = TRUE
    ORDER BY bounds.map_version DESC
    LIMIT 1
  `;

  const map = rows[0];
  if (!map) return null;

  return {
    ...map,
    imageUrl: await getSignedSpacesObjectUrl(map.filename),
  };
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

  const sql = table === 'district_table'
    ? `SELECT district_code, borough_name FROM "district_table" WHERE borough_name = $1 ORDER BY "_built_at" DESC LIMIT 10`
    : table === 'rent_quarterly' || table === 'housing_price_quarterly'
      ? `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY year DESC, quarter DESC LIMIT 40`
      : table === 'housing_stock_annual'
        ? `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY year DESC LIMIT 10`
      : `SELECT * FROM "${table}" WHERE borough_name = $1 ORDER BY ${orderByField} DESC LIMIT 10`;

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
    ['Total crimes per 1,000', row.total_crimes_per_1000, row.lon_avg_total_crimes_per_1000],
    ['Anti-social behaviour', row.anti_social_behaviour_per_1000, row.lon_avg_anti_social_behaviour_per_1000],
    ['Bicycle theft', row.bicycle_theft_per_1000, row.lon_avg_bicycle_theft_per_1000],
    ['Burglary', row.burglary_per_1000, row.lon_avg_burglary_per_1000],
    ['Criminal damage and arson', row.criminal_damage_arson_per_1000, row.lon_avg_criminal_damage_arson_per_1000],
    ['Drugs', row.drugs_per_1000, row.lon_avg_drugs_per_1000],
    ['Other crime', row.other_crime_per_1000, row.lon_avg_other_crime_per_1000],
    ['Other theft', row.other_theft_per_1000, row.lon_avg_other_theft_per_1000],
    ['Possession of weapons', row.possession_of_weapons_per_1000, row.lon_avg_possession_of_weapons_per_1000],
    ['Public order', row.public_order_per_1000, row.lon_avg_public_order_per_1000],
    ['Robbery', row.robbery_per_1000, row.lon_avg_robbery_per_1000],
    ['Shoplifting', row.shoplifting_per_1000, row.lon_avg_shoplifting_per_1000],
    ['Theft from the person', row.theft_from_the_person_per_1000, row.lon_avg_theft_from_the_person_per_1000],
    ['Vehicle crime', row.vehicle_crime_per_1000, row.lon_avg_vehicle_crime_per_1000],
    ['Violent crime', row.violent_crime_per_1000, row.lon_avg_violent_crime_per_1000],
  ];

  return metrics
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([label, value, comparisonValue]) => ({
      label: String(label),
      value: Number(value),
      crime_rate: Number(value),
      ...(comparisonValue === null || comparisonValue === undefined
        ? {}
        : { comparisonValue: Number(comparisonValue) }),
    }));
};

export const buildCrimeTrendData = (rows: Array<Record<string, unknown>>) => rows
  .flatMap((row) => {
    if (row.year == null || row.total_crimes_per_1000 == null) return [];
    const year = Number(row.year);
    const totalCrimesPer1000 = Number(row.total_crimes_per_1000);
    const averageValue = row.lon_avg_total_crimes_per_1000;
    return Number.isFinite(year) && Number.isFinite(totalCrimesPer1000)
      ? [{
          year,
          totalCrimesPer1000,
          londonAveragePer1000: averageValue !== null && averageValue !== undefined && Number.isFinite(Number(averageValue))
            ? Number(averageValue)
            : null,
        }]
      : [];
  })
  .sort((first, second) => first.year - second.year);

export const buildCrimeHighlight = (row: Record<string, unknown> = {}) => {
  const categories = [
    ['Anti-social behaviour', 'anti_social_behaviour_per_1000', 'pct_diff_anti_social_behaviour_per_1000', 'yoy_pct_change_anti_social_behaviour_per_1000'],
    ['Bicycle theft', 'bicycle_theft_per_1000', 'pct_diff_bicycle_theft_per_1000', 'yoy_pct_change_bicycle_theft_per_1000'],
    ['Burglary', 'burglary_per_1000', 'pct_diff_burglary_per_1000', 'yoy_pct_change_burglary_per_1000'],
    ['Criminal damage and arson', 'criminal_damage_arson_per_1000', 'pct_diff_criminal_damage_arson_per_1000', 'yoy_pct_change_criminal_damage_arson_per_1000'],
    ['Drugs', 'drugs_per_1000', 'pct_diff_drugs_per_1000', 'yoy_pct_change_drugs_per_1000'],
    ['Other crime', 'other_crime_per_1000', 'pct_diff_other_crime_per_1000', 'yoy_pct_change_other_crime_per_1000'],
    ['Other theft', 'other_theft_per_1000', 'pct_diff_other_theft_per_1000', 'yoy_pct_change_other_theft_per_1000'],
    ['Possession of weapons', 'possession_of_weapons_per_1000', 'pct_diff_possession_of_weapons_per_1000', 'yoy_pct_change_possession_of_weapons_per_1000'],
    ['Public order', 'public_order_per_1000', 'pct_diff_public_order_per_1000', 'yoy_pct_change_public_order_per_1000'],
    ['Robbery', 'robbery_per_1000', 'pct_diff_robbery_per_1000', 'yoy_pct_change_robbery_per_1000'],
    ['Shoplifting', 'shoplifting_per_1000', 'pct_diff_shoplifting_per_1000', 'yoy_pct_change_shoplifting_per_1000'],
    ['Theft from the person', 'theft_from_the_person_per_1000', 'pct_diff_theft_from_the_person_per_1000', 'yoy_pct_change_theft_from_the_person_per_1000'],
    ['Vehicle crime', 'vehicle_crime_per_1000', 'pct_diff_vehicle_crime_per_1000', 'yoy_pct_change_vehicle_crime_per_1000'],
    ['Violent crime', 'violent_crime_per_1000', 'pct_diff_violent_crime_per_1000', 'yoy_pct_change_violent_crime_per_1000'],
  ] as const;
  const gaps = categories.flatMap(([label, , gapField]) => {
    if (row[gapField] == null) return [];
    const value = Number(row[gapField]);
    return Number.isFinite(value) ? [{ label, value }] : [];
  });
  const changes = categories.flatMap(([label, , , changeField]) => {
    if (row[changeField] == null) return [];
    const value = Number(row[changeField]);
    return Number.isFinite(value) ? [{ label, value }] : [];
  });
  const lowestGap = gaps.sort((first, second) => first.value - second.value)[0];
  const largestIncrease = changes.sort((first, second) => second.value - first.value)[0];
  const totalCrimesPer1000 = row.total_crimes_per_1000 == null ? NaN : Number(row.total_crimes_per_1000);

  if (!Number.isFinite(totalCrimesPer1000)) return null;

  return {
    year: Number(row.year),
    totalCrimesPer1000,
    rank: Number.isFinite(Number(row.safety_rank_total_crimes_per_1000))
      ? Number(row.safety_rank_total_crimes_per_1000)
      : null,
    yoyChangePct: Number.isFinite(Number(row.yoy_pct_change_total_crimes_per_1000))
      ? Number(row.yoy_pct_change_total_crimes_per_1000)
      : null,
    lowestGapCategory: lowestGap?.label ?? null,
    lowestGapPct: lowestGap?.value ?? null,
    largestIncreaseCategory: largestIncrease?.label ?? null,
    largestIncreasePct: largestIncrease?.value ?? null,
  };
};

export const buildPropertyValueData = (rows: Array<Record<string, unknown>>) => {
  return rows.flatMap((row) => {
    const value = Number(row.value ?? row.avg_price ?? 0);
    const periodLabel = String(row.quarter_label ?? row.date ?? row.year ?? '');
    const propertyValueData = value ? [{
      label: periodLabel || 'Average price',
      value,
    }] : [];
    const growth = Number(row.yoy_growth_pct ?? row.yoy_growth ?? NaN);
    if (Number.isFinite(growth)) propertyValueData.push({
      label: periodLabel ? `YoY growth · ${periodLabel}` : 'YoY growth',
      value: growth,
    });
    return propertyValueData;
  });
};

export const buildDemographyData = (rows: Array<Record<string, unknown>>) => {
  return rows.map((row) => ({
    age_group: String(row.age_group ?? row.label ?? 'Unknown'),
    percentage: Number(row.percentage ?? 0),
  }));
};

export const buildWeightedLsoaDemographyData = (rows: Array<Record<string, unknown>>) => {
  const ageGroups = [
    { label: '0-9', ages: Array.from({ length: 10 }, (_, index) => index) },
    { label: '10-19', ages: Array.from({ length: 10 }, (_, index) => index + 10) },
    { label: '20-29', ages: Array.from({ length: 10 }, (_, index) => index + 20) },
    { label: '30-39', ages: Array.from({ length: 10 }, (_, index) => index + 30) },
    { label: '40-49', ages: Array.from({ length: 10 }, (_, index) => index + 40) },
    { label: '50-59', ages: Array.from({ length: 10 }, (_, index) => index + 50) },
    { label: '60+', ages: Array.from({ length: 30 }, (_, index) => index + 60) },
  ];
  const getWeight = (row: Record<string, unknown>) => {
    const weight = Number(row.allocationWeight ?? row.allocation_weight ?? 1);
    return Number.isFinite(weight) && weight > 0 ? weight : 0;
  };
  const weightedPopulation = rows.reduce((total, row) => {
    const population = Number(row.total ?? 0);
    return total + (Number.isFinite(population) && population > 0 ? population * getWeight(row) : 0);
  }, 0);

  if (weightedPopulation <= 0) return [];

  const getWeightedCount = (ages: number[], gender: 'F' | 'M') => rows.reduce((total, row) => {
      const weight = getWeight(row);
      if (weight === 0) return total;
      const ageCount = ages.reduce((subtotal, age) => subtotal + Number(row[`${gender}${age}`] ?? 0), 0)
        + (ages.includes(60) ? Number(row[`${gender}90+`] ?? 0) : 0);
      return total + (Number.isFinite(ageCount) ? ageCount * weight : 0);
    }, 0);

  return ageGroups.map(({ label, ages }) => {
    const femaleCount = getWeightedCount(ages, 'F');
    const maleCount = getWeightedCount(ages, 'M');
    return {
      age_group: label,
      female_percentage: Number(((femaleCount / weightedPopulation) * 100).toFixed(1)),
      male_percentage: Number(((maleCount / weightedPopulation) * 100).toFixed(1)),
      percentage: Number((((femaleCount + maleCount) / weightedPopulation) * 100).toFixed(1)),
      period: rows.find((row) => row.year_name)?.year_name ?? null,
    };
  });
};

export const buildEducationData = (rows: Array<Record<string, unknown>>) => {
  const latest = rows[0] as Record<string, unknown> | undefined;
  if (!latest) return [];

  const metrics = [
    ['Independent schools', latest.independent_school_count],
    ['Publicly funded nurseries', latest.public_funded_nursery],
    ['Publicly funded primary schools', latest.public_funded_primary],
    ['Publicly funded secondary schools', latest.public_funded_secondary],
    ['Publicly funded schools', latest.public_funded_school_count],
    ['Total schools', latest.total_school_count],
    ['GCSE attainment 8', latest.gcse_attainment_8],
    ['Strong pass English and maths', latest.strong_pass_eng_maths],
    ['KS2 expected standard', latest.ks2_expectedstandard_read_write_maths],
    ['KS2 higher standard', latest.ks2_higherstandard_read_write_maths],
    ['Ofsted good or outstanding', latest.ofsted_goodand_outstanding],
    ['Ofsted London average', latest.ofsted_london_average],
    ['Education rank', latest.education_rank],
  ];

  return metrics
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([label, value]) => ({ label: String(label), value: Number(value) }));
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

  const [demography, lsoaDemography, propertyValueData, rentData, crimeData, votingData, rentQuarterlyRows, housingPriceRows, policeRows, educationRows, housingStockRows, districtRows, lsoaMap, transport] =
    await Promise.all([
      getLatestData('demography', getPostcodeFilter(normalizedCode)),
      getLsoaDemographicsForPostcode(normalizedCode),
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
      getLsoaMapForPostcode(normalizedCode),
      getLsoaTransportForPostcode(normalizedCode),
    ]);

  const rentDataRows = Array.isArray(rentData) ? (rentData as Array<Record<string, unknown>>) : [];
  const propertyValueRows = Array.isArray(propertyValueData) ? (propertyValueData as Array<Record<string, unknown>>) : [];
  const crimeRows = Array.isArray(crimeData) ? (crimeData as Array<Record<string, unknown>>) : [];
  const demographyRows = Array.isArray(demography) ? (demography as Array<Record<string, unknown>>) : [];
  const lsoaDemographyRows = Array.isArray(lsoaDemography) ? (lsoaDemography as Array<Record<string, unknown>>) : [];
  const rentQuarterlyRowsTyped = Array.isArray(rentQuarterlyRows) ? (rentQuarterlyRows as Array<Record<string, unknown>>) : [];
  const housingPriceRowsTyped = Array.isArray(housingPriceRows) ? (housingPriceRows as Array<Record<string, unknown>>) : [];
  const policeRowsTyped = Array.isArray(policeRows) ? (policeRows as Array<Record<string, unknown>>) : [];
  const educationRowsTyped = Array.isArray(educationRows) ? (educationRows as Array<Record<string, unknown>>) : [];
  const housingStockRowsTyped = Array.isArray(housingStockRows) ? (housingStockRows as Array<Record<string, unknown>>) : [];
  const districtRowsTyped = Array.isArray(districtRows) ? (districtRows as Array<Record<string, unknown>>) : [];
  const housingStockTrendData = housingStockRowsTyped
    .map((row) => ({
      year: Number(row.year),
      totalDwellings: Number(row.total_dwellings),
      netAdditions: Number(row.net_additions),
    }))
    .filter((row, index, rows) =>
      Number.isFinite(row.year)
      && Number.isFinite(row.totalDwellings)
      && Number.isFinite(row.netAdditions)
      && rows.findIndex((candidate) => candidate.year === row.year) === index,
    )
    .sort((first, second) => second.year - first.year)
    .slice(0, 2);

  const mappedRentData = rentDataRows.length > 0
    ? rentDataRows.map((row) => ({ rent: Number((row as any).rent ?? 0), type: String((row as any).property_type ?? 'average') }))
    : buildRentData(rentQuarterlyRowsTyped);

  const mappedPropertyValueData = propertyValueRows.length > 0
    ? propertyValueRows.map((row) => ({
        label: String((row as any).date ?? (row as any).year ?? 'Latest value'),
        value: Number((row as any).value ?? 0),
      }))
    : buildPropertyValueData(housingPriceRowsTyped);

  const mappedCrimeData = crimeRows.length > 0
    ? crimeRows.map((row) => ({
        label: String((row as any).crime_type ?? 'Crime'),
        crime_rate: Number((row as any).crime_rate ?? 0),
        value: Number((row as any).crime_rate ?? 0),
      }))
    : buildCrimeData(policeRowsTyped[0] ?? {});

  const mappedDemography = lsoaDemographyRows.length > 0
    ? buildWeightedLsoaDemographyData(lsoaDemographyRows)
    : demographyRows.length > 0
    ? demographyRows.map((row) => ({
        age_group: String((row as any).age_group ?? 'Unknown'),
        percentage: Number((row as any).percentage ?? 0),
      }))
    : buildDemographyData(demographyRows);
  const weightedDemographyPopulation = lsoaDemographyRows.reduce((total, row) => {
    const population = Number(row.total ?? 0);
    const allocationWeight = Number(row.allocationWeight ?? row.allocation_weight ?? 1);
    return Number.isFinite(population) && population > 0 && Number.isFinite(allocationWeight) && allocationWeight > 0
      ? total + population * allocationWeight
      : total;
  }, 0);

  const latestPoliceRow = policeRowsTyped[0];
  const crimeRateContext = latestPoliceRow
    ? {
        boroughName: String(latestPoliceRow.borough_name ?? boroughName ?? 'Borough'),
        year: Number(latestPoliceRow.year),
        population: Number(latestPoliceRow.population),
        annualisedCrimes: Number(latestPoliceRow.total_crimes_annualised),
        ratePer1000: Number(latestPoliceRow.total_crimes_per_1000),
        londonAveragePer1000: Number(latestPoliceRow.lon_avg_total_crimes_per_1000),
      }
    : null;

  return {
    postcode,
    lsoaMap,
    transport,
    crimeRateContext,
    borough: borough ?? null,
    crimeData: mappedCrimeData,
    demography: mappedDemography,
    demographyPopulation: weightedDemographyPopulation > 0 ? Math.round(weightedDemographyPopulation) : null,
    propertyValueData: mappedPropertyValueData,
    priceTrendData: housingPriceRowsTyped
      .map((row) => ({ year: Number(row.year), quarter: Number(row.quarter), value: Number(row.avg_price ?? 0) }))
      .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.value) && row.value > 0)
      .reverse(),
    rentData: mappedRentData,
    rentTrendData: rentQuarterlyRowsTyped
      .map((row) => ({ year: Number(row.year), quarter: Number(row.quarter), value: Number(row.rent_all ?? 0) }))
      .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.value) && row.value > 0)
      .reverse(),
    votingData,
    educationData: buildEducationData(educationRowsTyped),
    housingStockData: buildHousingStockData(housingStockRowsTyped),
    housingStockTrendData,
    districtData: buildDistrictData(districtRowsTyped),
  };
};

