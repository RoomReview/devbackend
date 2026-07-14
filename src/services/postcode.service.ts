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
import { findBoroughById } from '@/repositories/borough.repository';

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
  // Normalize code by uppercase and trim
  const normalizedCode = code.toUpperCase().replace(/\s+/g, '');
  const postcode = await findPostcodeByCode(normalizedCode);
  if (!postcode) {
    throw new EntityNotFoundError({
      message: `Postcode with code ${code} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return postcode;
};

export const createNewPostcode = async (data: CreatePostcodeDto) => {
  const normalizedCode = data.code.toUpperCase().replace(/\s+/g, '');
  
  // Check unique constraint
  const existingCode = await findPostcodeByCode(normalizedCode);
  if (existingCode) {
    throw new ValidationError({
      message: `Postcode with code ${data.code} already exists`,
      code: 'VALIDATION_ERROR',
    });
  }

  // Validate boroughId if provided
  if (data.boroughId) {
    const boroughExists = await findBoroughById(data.boroughId);
    if (!boroughExists) {
      throw new ValidationError({
        message: `Borough with ID ${data.boroughId} does not exist`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  return await createPostcode({
    code: normalizedCode,
    outcode: data.outcode.toUpperCase().trim(),
    incode: data.incode.toUpperCase().trim(),
    latitude: data.latitude,
    longitude: data.longitude,
    metrics: data.metrics || {},
    ...(data.boroughId ? { borough: { connect: { boroughId: data.boroughId } } } : {}),
  });
};

export const updatePostcodeById = async (id: string, data: UpdatePostcodeDto) => {
  await getPostcodeById(id); // Throws 404 if missing

  if (data.code) {
    const normalizedCode = data.code.toUpperCase().replace(/\s+/g, '');
    const existingCode = await findPostcodeByCode(normalizedCode);
    if (existingCode && existingCode.postcodeId !== id) {
      throw new ValidationError({
        message: `Postcode with code ${data.code} already exists`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  if (data.boroughId) {
    const boroughExists = await findBoroughById(data.boroughId);
    if (!boroughExists) {
      throw new ValidationError({
        message: `Borough with ID ${data.boroughId} does not exist`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  return await updatePostcode(id, {
    code: data.code ? data.code.toUpperCase().replace(/\s+/g, '') : undefined,
    outcode: data.outcode ? data.outcode.toUpperCase().trim() : undefined,
    incode: data.incode ? data.incode.toUpperCase().trim() : undefined,
    latitude: data.latitude,
    longitude: data.longitude,
    metrics: data.metrics,
    ...(data.boroughId ? { borough: { connect: { boroughId: data.boroughId } } } : {}),
  });
};

export const deletePostcodeById = async (id: string) => {
  await getPostcodeById(id); // Throws 404 if missing
  return await deletePostcode(id);
};
