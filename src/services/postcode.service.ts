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
import { normalizePostcodeCode } from '@/utils/postcode';
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
  return buildPaginatedResult(postcodes, total, page, limit);
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
