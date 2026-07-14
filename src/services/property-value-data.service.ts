import {
  createPropertyValueData,
  createManyPropertyValueData,
  findPropertyValueDataById,
  findAllPropertyValueData,
  countPropertyValueData,
  updatePropertyValueData,
  deletePropertyValueData,
  FindPropertyValueDataFilter,
} from '@/repositories/property-value-data.repository';
import { EntityNotFoundError } from '@/utils/custom-error';
import type { CreatePropertyValueDataDto, UpdatePropertyValueDataDto } from '@/dto/property-value-data.dto';
import { paginate, buildPaginatedResult } from '@/utils/helpers';

export const getAllPropertyValueData = async (page: number, limit: number, filter?: FindPropertyValueDataFilter) => {
  const { offset } = paginate(page, limit);
  const [items, total] = await Promise.all([
    findAllPropertyValueData(limit, offset, filter),
    countPropertyValueData(filter),
  ]);
  return buildPaginatedResult(items, total, page, limit);
};

export const getPropertyValueDataById = async (id: string) => {
  const data = await findPropertyValueDataById(id);
  if (!data) {
    throw new EntityNotFoundError({
      message: `Property value data with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return data;
};

export const createNewPropertyValueData = async (data: CreatePropertyValueDataDto) => {
  return await createPropertyValueData({
    postcode: data.postcode,
    value: data.value,
    date: new Date(data.date),
    source: data.source,
  });
};

export const bulkCreatePropertyValueData = async (data: CreatePropertyValueDataDto[]) => {
  return await createManyPropertyValueData(
    data.map(item => ({
      postcode: item.postcode,
      value: item.value,
      date: new Date(item.date),
      source: item.source,
    }))
  );
};

export const updatePropertyValueDataById = async (id: string, data: UpdatePropertyValueDataDto) => {
  await getPropertyValueDataById(id); // Throws 404 if missing

  const updateData: any = {
    postcode: data.postcode,
    value: data.value,
    date: data.date ? new Date(data.date) : undefined,
    source: data.source,
  };

  return await updatePropertyValueData(id, updateData);
};

export const deletePropertyValueDataById = async (id: string) => {
  await getPropertyValueDataById(id); // Throws 404 if missing
  return await deletePropertyValueData(id);
};
