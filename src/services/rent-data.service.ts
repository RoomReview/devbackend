import {
  createRentData,
  createManyRentData,
  findRentDataById,
  findAllRentData,
  countRentData,
  updateRentData,
  deleteRentData,
  FindRentDataFilter,
} from '@/repositories/rent-data.repository';
import { EntityNotFoundError } from '@/utils/custom-error';
import type { CreateRentDataDto, UpdateRentDataDto } from '@/dto/rent-data.dto';
import { paginate, buildPaginatedResult } from '@/utils/helpers';

export const getAllRentData = async (page: number, limit: number, filter?: FindRentDataFilter) => {
  const { offset } = paginate(page, limit);
  const [items, total] = await Promise.all([
    findAllRentData(limit, offset, filter),
    countRentData(filter),
  ]);
  return buildPaginatedResult(items, total, page, limit);
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
    rent: data.rent,
    date: new Date(data.date),
    source: data.source,
  });
};

export const bulkCreateRentData = async (data: CreateRentDataDto[]) => {
  return await createManyRentData(
    data.map(item => ({
      postcode: item.postcode,
      propertyType: item.propertyType,
      rent: item.rent,
      date: new Date(item.date),
      source: item.source,
    }))
  );
};

export const updateRentDataById = async (id: string, data: UpdateRentDataDto) => {
  await getRentDataById(id); // Throws 404 if missing

  const updateData: any = {
    postcode: data.postcode,
    propertyType: data.propertyType,
    rent: data.rent,
    date: data.date ? new Date(data.date) : undefined,
    source: data.source,
  };

  return await updateRentData(id, updateData);
};

export const deleteRentDataById = async (id: string) => {
  await getRentDataById(id); // Throws 404 if missing
  return await deleteRentData(id);
};
