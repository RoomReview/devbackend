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
import { paginate } from '@/utils/helpers';

export const getAllDemography = async (page: number, limit: number, filter?: FindDemographyFilter) => {
  const { offset } = paginate(page, limit);
  const items = await findAllDemography(limit, offset, filter);
  const total = await countDemography(filter);
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
    population: data.population,
    medianAge: data.medianAge,
    socialGrade: data.socialGrade,
    recordedDate: new Date(data.recordedDate),
  });
};

export const bulkCreateDemography = async (data: CreateDemographyDto[]) => {
  return await createManyDemography(
    data.map(item => ({
      postcode: item.postcode,
      population: item.population,
      medianAge: item.medianAge,
      socialGrade: item.socialGrade,
      recordedDate: new Date(item.recordedDate),
    }))
  );
};

export const updateDemographyById = async (id: string, data: UpdateDemographyDto) => {
  await getDemographyById(id); // Throws 404 if missing

  const updateData: any = {
    postcode: data.postcode,
    population: data.population,
    medianAge: data.medianAge,
    socialGrade: data.socialGrade,
    recordedDate: data.recordedDate ? new Date(data.recordedDate) : undefined,
  };

  return await updateDemography(id, updateData);
};

export const deleteDemographyById = async (id: string) => {
  await getDemographyById(id); // Throws 404 if missing
  return await deleteDemography(id);
};
