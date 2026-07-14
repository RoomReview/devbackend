import {
  createDemography,
  createManyDemography,
  findDemographyById,
  findAllDemography,
  countDemography,
  updateDemography,
  deleteDemography,
  FindDemographyFilter,
} from '@/repositories/demography.repository';
import { EntityNotFoundError } from '@/utils/custom-error';
import type { CreateDemographyDto, UpdateDemographyDto } from '@/dto/demography.dto';
import { paginate, buildPaginatedResult } from '@/utils/helpers';

export const getAllDemography = async (page: number, limit: number, filter?: FindDemographyFilter) => {
  const { offset } = paginate(page, limit);
  const [items, total] = await Promise.all([
    findAllDemography(limit, offset, filter),
    countDemography(filter),
  ]);
  return buildPaginatedResult(items, total, page, limit);
};

export const getDemographyById = async (id: string) => {
  const data = await findDemographyById(id);
  if (!data) {
    throw new EntityNotFoundError({
      message: `Demography record with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return data;
};

export const createNewDemography = async (data: CreateDemographyDto) => {
  return await createDemography({
    postcode: data.postcode,
    ageGroup: data.ageGroup,
    percentage: data.percentage,
    date: new Date(data.date),
    source: data.source,
  });
};

export const bulkCreateDemography = async (data: CreateDemographyDto[]) => {
  return await createManyDemography(
    data.map(item => ({
      postcode: item.postcode,
      ageGroup: item.ageGroup,
      percentage: item.percentage,
      date: new Date(item.date),
      source: item.source,
    }))
  );
};

export const updateDemographyById = async (id: string, data: UpdateDemographyDto) => {
  await getDemographyById(id); // Throws 404 if missing

  const updateData: any = {
    postcode: data.postcode,
    ageGroup: data.ageGroup,
    percentage: data.percentage,
    date: data.date ? new Date(data.date) : undefined,
    source: data.source,
  };

  return await updateDemography(id, updateData);
};

export const deleteDemographyById = async (id: string) => {
  await getDemographyById(id); // Throws 404 if missing
  return await deleteDemography(id);
};
