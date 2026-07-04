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
import { paginate } from '@/utils/helpers';

export const getAllPropertyValueData = async (page: number, limit: number, filter?: FindPropertyValueDataFilter) => {
  const { offset } = paginate(page, limit);
  const items = await findAllPropertyValueData(limit, offset, filter);
  const total = await countPropertyValueData(filter);
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
    averageValue: data.averageValue,
    growthRate: data.growthRate,
    salesVolume: data.salesVolume,
    recordedDate: new Date(data.recordedDate),
  });
};

export const bulkCreatePropertyValueData = async (data: CreatePropertyValueDataDto[]) => {
  return await createManyPropertyValueData(
    data.map(item => ({
      postcode: item.postcode,
      averageValue: item.averageValue,
      growthRate: item.growthRate,
      salesVolume: item.salesVolume,
      recordedDate: new Date(item.recordedDate),
    }))
  );
};

export const updatePropertyValueDataById = async (id: string, data: UpdatePropertyValueDataDto) => {
  await getPropertyValueDataById(id); // Throws 404 if missing

  const updateData: any = {
    postcode: data.postcode,
    averageValue: data.averageValue,
    growthRate: data.growthRate,
    salesVolume: data.salesVolume,
    recordedDate: data.recordedDate ? new Date(data.recordedDate) : undefined,
  };

  return await updatePropertyValueData(id, updateData);
};

export const deletePropertyValueDataById = async (id: string) => {
  await getPropertyValueDataById(id); // Throws 404 if missing
  return await deletePropertyValueData(id);
};
