import {
  createPostcode,
  findPostcodeById,
  findPostcodeByCode,
  findAllPostcodes,
  countPostcodes,
  updatePostcode,
  deletePostcode,
  FindPostcodesFilter,
} from '@/repositories/postcode.repository';
import { EntityNotFoundError, ValidationError } from '@/utils/custom-error';
import type { CreatePostcodeDto, UpdatePostcodeDto } from '@/dto/postcode.dto';
import { paginate, buildPaginatedResult } from '@/utils/helpers';
import { findBoroughById, findBoroughByName } from '@/repositories/borough.repository';
import { getPostcodeLookupCandidates, normalizePostcodeCode } from '@/utils/postcode';
import { getPostcodeDataByCode } from '@/services/postcode-data.service';
import prisma from '@config/database';

const districtCodePattern = /^E\d{8}$/i;

const resolveBoroughId = async (boroughReference: string | undefined) => {
  if (!boroughReference) return undefined;

  if (!districtCodePattern.test(boroughReference)) {
    return (await findBoroughById(boroughReference))?.boroughId;
  }

  const rows = await prisma.$queryRaw<{ borough_name: string | null }[]>`
    SELECT borough_name
    FROM "district_table"
    WHERE district_code = ${boroughReference.toUpperCase()}
    ORDER BY "_built_at" DESC
    LIMIT 1
  `;
  const boroughName = rows[0]?.borough_name?.trim();
  if (!boroughName) return undefined;

  return (await findBoroughByName(boroughName))?.boroughId;
};

export const getAllPostcodes = async (page: number, limit: number, filter?: FindPostcodesFilter) => {
  const { offset } = paginate(page, limit);
  const [postcodes, total] = await Promise.all([
    findAllPostcodes(limit, offset, filter),
    countPostcodes(filter),
  ]);
  if (postcodes.length === 0) return buildPaginatedResult(postcodes, total, page, limit);

  const postcodeIds = postcodes.map(({ postcodeId }) => postcodeId);
  const propertyCodeCandidates = [...new Set(postcodes.flatMap(({ code }) => getPostcodeLookupCandidates(code)))];
  const [reviews, propertyValues, housingPrices, crimeRates] = await Promise.all([
    prisma.reviews.groupBy({
      by: ['postcode_id'],
      where: { postcode_id: { in: postcodeIds }, status: 'APPROVED' },
      _avg: { overall_rating: true },
      _count: { _all: true },
    }),
    prisma.property_value_data.findMany({
      where: { postcode: { in: propertyCodeCandidates } },
      orderBy: { date: 'desc' },
      select: { postcode: true, value: true, date: true },
    }),
    prisma.$queryRaw<Array<{
      boroughName: string;
      averagePrice: number | string | null;
      growthPct: number | string | null;
    }>>`
      SELECT DISTINCT ON (lower(regexp_replace(replace(borough_name, '&', 'and'), '^city of ', '')))
        borough_name AS "boroughName",
        avg_price AS "averagePrice",
        yoy_growth_pct AS "growthPct"
      FROM housing_price_quarterly
      WHERE lower(borough_name) <> 'london'
      ORDER BY lower(regexp_replace(replace(borough_name, '&', 'and'), '^city of ', '')), year DESC, quarter DESC
    `,
    prisma.$queryRaw<Array<{
      boroughName: string;
      crimeRatePer1000: number | string | null;
      londonAveragePer1000: number | string | null;
    }>>`
      SELECT DISTINCT ON (lower(regexp_replace(replace(borough_name, '&', 'and'), '^city of ', '')))
        borough_name AS "boroughName",
        total_crimes_per_1000 AS "crimeRatePer1000",
        lon_avg_total_crimes_per_1000 AS "londonAveragePer1000"
      FROM police_police
      WHERE lower(borough_name) <> 'london'
      ORDER BY lower(regexp_replace(replace(borough_name, '&', 'and'), '^city of ', '')), year DESC
    `,
  ]);

  const normalizeBoroughName = (name: string) => name
    .trim()
    .toLowerCase()
    .replace(/^city of /, '')
    .replace(/&/g, 'and');
  const priceByBorough = new Map(housingPrices.map((row) => [
    normalizeBoroughName(row.boroughName),
    {
      averagePrice: row.averagePrice === null ? null : Number(row.averagePrice),
      growthPct: row.growthPct === null ? null : Number(row.growthPct),
    },
  ]));
  const crimeByBorough = new Map(crimeRates.map((row) => [
    normalizeBoroughName(row.boroughName),
    {
      rate: row.crimeRatePer1000 === null ? null : Number(row.crimeRatePer1000),
      londonAverage: row.londonAveragePer1000 === null ? null : Number(row.londonAveragePer1000),
    },
  ]));
  const postcodePriceRows = new Map<string, Array<{ value: number; date: Date }>>();
  for (const row of propertyValues) {
    const code = normalizePostcodeCode(row.postcode);
    const values = postcodePriceRows.get(code) ?? [];
    values.push({ value: Number(row.value), date: row.date });
    postcodePriceRows.set(code, values);
  }
  const priceByPostcode = new Map<string, { averagePrice: number | null; growthPct: number | null }>(
    [...postcodePriceRows].map(([code, rows]) => {
      const valuesByDate = new Map<string, { date: Date; total: number; count: number }>();
      for (const row of rows) {
        if (!Number.isFinite(row.value) || row.value <= 0) {
          continue;
        }
        const dateKey = row.date.toISOString().slice(0, 10);
        const entry = valuesByDate.get(dateKey) ?? { date: row.date, total: 0, count: 0 };
        entry.total += row.value;
        entry.count += 1;
        valuesByDate.set(dateKey, entry);
      }
      const history = [...valuesByDate.values()].sort((first, second) => second.date.getTime() - first.date.getTime());
      const latest = history[0];
      if (!latest) {
        return [code, { averagePrice: null, growthPct: null }] as const;
      }

      const latestAverage = latest.total / latest.count;
      const yearAgo = new Date(latest.date);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      const prior = history
        .filter((entry) => Math.abs(entry.date.getTime() - yearAgo.getTime()) <= 45 * 24 * 60 * 60 * 1000)
        .sort((first, second) => Math.abs(first.date.getTime() - yearAgo.getTime()) - Math.abs(second.date.getTime() - yearAgo.getTime()))[0];

      return [code, {
        averagePrice: latestAverage,
        growthPct: prior && prior.total > 0 ? ((latestAverage - prior.total / prior.count) / (prior.total / prior.count)) * 100 : null,
      }] as const;
    }),
  );
  const reviewByPostcode = new Map(reviews.flatMap((review) => review.postcode_id
    ? [[review.postcode_id, {
        averageRating: review._avg.overall_rating,
        reviewCount: review._count._all,
      }] as const]
    : []));

  const result = buildPaginatedResult(postcodes, total, page, limit);
  return {
    ...result,
    data: postcodes.map((postcode) => {
      const boroughName = postcode.borough?.name ?? null;
      const normalizedCode = normalizePostcodeCode(postcode.code);
      const postcodePrice = priceByPostcode.get(normalizedCode);
      const boroughPrice = boroughName ? priceByBorough.get(normalizeBoroughName(boroughName)) : undefined;
      const crime = boroughName ? crimeByBorough.get(normalizeBoroughName(boroughName)) : undefined;
      const review = reviewByPostcode.get(postcode.postcodeId);
      return {
        ...postcode,
        boroughName,
        averagePrice: postcodePrice?.averagePrice ?? boroughPrice?.averagePrice ?? null,
        priceSource: postcodePrice?.averagePrice !== null && postcodePrice?.averagePrice !== undefined
          ? 'postcode' as const
          : boroughPrice?.averagePrice !== null && boroughPrice?.averagePrice !== undefined
            ? 'borough' as const
            : null,
        priceGrowthPct: postcodePrice?.averagePrice !== null && postcodePrice?.averagePrice !== undefined
          ? postcodePrice.growthPct
          : boroughPrice?.growthPct ?? null,
        crimeRatePer1000: crime?.rate ?? null,
        londonAverageCrimeRatePer1000: crime?.londonAverage ?? null,
        averageRating: review?.averageRating ?? null,
        reviewCount: review?.reviewCount ?? 0,
      };
    }),
  };
};

export const getPostcodeById = async (id: string) => {
  const postcode = await findPostcodeById(id);
  if (!postcode) {
    throw new EntityNotFoundError({
      message: `Postcode with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return postcode;
};

export const getPostcodeByCode = async (code: string) => {
  const normalizedCode = normalizePostcodeCode(code);
  const postcode = await findPostcodeByCode(normalizedCode);
  if (!postcode) {
    throw new EntityNotFoundError({
      message: `Postcode with code ${code} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return postcode;
};

export const getPostcodeReportDataByCode = async (code: string) => {
  return getPostcodeDataByCode(code);
};

export const createNewPostcode = async (data: CreatePostcodeDto) => {
  const normalizedCode = normalizePostcodeCode(data.code);

  const existingCode = await findPostcodeByCode(normalizedCode);
  if (existingCode) {
    throw new ValidationError({
      message: `Postcode with code ${data.code} already exists`,
      code: 'VALIDATION_ERROR',
    });
  }

  const boroughId = await resolveBoroughId(data.boroughId);
  if (data.boroughId && !boroughId) {
      throw new ValidationError({
        message: `Borough reference ${data.boroughId} does not resolve to an existing borough`,
        code: 'VALIDATION_ERROR',
      });
  }

  return await createPostcode({
    code: normalizedCode,
    outcode: data.outcode.toUpperCase().trim(),
    incode: data.incode.toUpperCase().trim(),
    latitude: data.latitude,
    longitude: data.longitude,
    metrics: data.metrics || {},
    ...(boroughId ? { borough: { connect: { boroughId } } } : {}),
  });
};

export const updatePostcodeById = async (id: string, data: UpdatePostcodeDto) => {
  await getPostcodeById(id);

  if (data.code) {
    const normalizedCode = normalizePostcodeCode(data.code);
    const existingCode = await findPostcodeByCode(normalizedCode);
    if (existingCode && existingCode.postcodeId !== id) {
      throw new ValidationError({
        message: `Postcode with code ${data.code} already exists`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  const boroughId = await resolveBoroughId(data.boroughId);
  if (data.boroughId && !boroughId) {
      throw new ValidationError({
        message: `Borough reference ${data.boroughId} does not resolve to an existing borough`,
        code: 'VALIDATION_ERROR',
      });
  }

  return await updatePostcode(id, {
    code: data.code ? normalizePostcodeCode(data.code) : undefined,
    outcode: data.outcode ? data.outcode.toUpperCase().trim() : undefined,
    incode: data.incode ? data.incode.toUpperCase().trim() : undefined,
    latitude: data.latitude,
    longitude: data.longitude,
    metrics: data.metrics,
    ...(boroughId ? { borough: { connect: { boroughId } } } : {}),
  });
};

export const deletePostcodeById = async (id: string) => {
  await getPostcodeById(id);
  return await deletePostcode(id);
};
