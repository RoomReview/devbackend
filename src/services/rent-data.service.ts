import {
  createRentData,
  findRentDataById,
  findAllRentData,
  countRentData,
  updateRentData,
  deleteRentData,
  FindRentDataFilter,
} from '@/repositories/rent-data.repository';
import { EntityNotFoundError } from '@/utils/custom-error';
import type { CreateRentDataDto, UpdateRentDataDto } from '@/dto/rent-data.dto';
import { paginate } from '@/utils/helpers';

export const getAllRentData = async (page: number, limit: number, filter?: FindRentDataFilter) => {
  const { offset } = paginate(page, limit);
  const items = await findAllRentData(limit, offset, filter);
  const total = await countRentData(filter);
  const totalPages = Math.ceil(total / limit);

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

export const getRentDataById = async (id: string) => {
  const data = await findRentDataById(id);
  if (!data) {
    throw new EntityNotFoundError({
      message: `Rent data with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return data;
};

export const createNewRentData = async (data: CreateRentDataDto) => {
  return await createRentData({
    postcode: data.postcode,
    propertyType: data.propertyType,
    bedrooms: data.bedrooms,
    averageRent: data.averageRent,
    minRent: data.minRent,
    maxRent: data.maxRent,
    sampleSize: data.sampleSize,
    recordedDate: new Date(data.recordedDate),
  });
};

export const updateRentDataById = async (id: string, data: UpdateRentDataDto) => {
  await getRentDataById(id); // Throws 404 if missing

  const updateData: any = {
    postcode: data.postcode,
    propertyType: data.propertyType,
    bedrooms: data.bedrooms,
    averageRent: data.averageRent,
    minRent: data.minRent,
    maxRent: data.maxRent,
    sampleSize: data.sampleSize,
    recordedDate: data.recordedDate ? new Date(data.recordedDate) : undefined,
  };

  return await updateRentData(id, updateData);
};

export const deleteRentDataById = async (id: string) => {
  await getRentDataById(id); // Throws 404 if missing
  return await deleteRentData(id);
};
