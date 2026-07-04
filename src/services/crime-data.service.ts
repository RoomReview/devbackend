import {
  createCrimeData,
  createManyCrimeData,
  findCrimeDataById,
  findAllCrimeData,
  countCrimeData,
  updateCrimeData,
  deleteCrimeData,
  FindCrimeDataFilter,
} from '@/repositories/crime-data.repository';
import { EntityNotFoundError } from '@/utils/custom-error';
import type { CreateCrimeDataDto, UpdateCrimeDataDto } from '@/dto/crime-data.dto';
import { paginate } from '@/utils/helpers';

export const getAllCrimeData = async (page: number, limit: number, filter?: FindCrimeDataFilter) => {
  const { offset } = paginate(page, limit);
  const items = await findAllCrimeData(limit, offset, filter);
  const total = await countCrimeData(filter);
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

export const getCrimeDataById = async (id: string) => {
  const data = await findCrimeDataById(id);
  if (!data) {
    throw new EntityNotFoundError({
      message: `Crime data with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return data;
};

export const createNewCrimeData = async (data: CreateCrimeDataDto) => {
  return await createCrimeData({
    borough: data.borough,
    crimeType: data.crimeType,
    crimeCount: data.crimeCount,
    recordedDate: new Date(data.recordedDate),
  });
};

export const bulkCreateCrimeData = async (data: CreateCrimeDataDto[]) => {
  return await createManyCrimeData(
    data.map(item => ({
      borough: item.borough,
      crimeType: item.crimeType,
      crimeCount: item.crimeCount,
      recordedDate: new Date(item.recordedDate),
    }))
  );
};

export const updateCrimeDataById = async (id: string, data: UpdateCrimeDataDto) => {
  await getCrimeDataById(id); // Throws 404 if missing

  const updateData: any = {
    borough: data.borough,
    crimeType: data.crimeType,
    crimeCount: data.crimeCount,
    recordedDate: data.recordedDate ? new Date(data.recordedDate) : undefined,
  };

  return await updateCrimeData(id, updateData);
};

export const deleteCrimeDataById = async (id: string) => {
  await getCrimeDataById(id); // Throws 404 if missing
  return await deleteCrimeData(id);
};
