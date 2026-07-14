import {
  createVotingData,
  createManyVotingData,
  findVotingDataById,
  findAllVotingData,
  countVotingData,
  updateVotingData,
  deleteVotingData,
  FindVotingDataFilter,
} from '@/repositories/voting-data.repository';
import { EntityNotFoundError } from '@/utils/custom-error';
import type { CreateVotingDataDto, UpdateVotingDataDto } from '@/dto/voting-data.dto';
import { paginate, buildPaginatedResult } from '@/utils/helpers';

export const getAllVotingData = async (page: number, limit: number, filter?: FindVotingDataFilter) => {
  const { offset } = paginate(page, limit);
  const [items, total] = await Promise.all([
    findAllVotingData(limit, offset, filter),
    countVotingData(filter),
  ]);
  return buildPaginatedResult(items, total, page, limit);
};

export const getVotingDataById = async (id: string) => {
  const data = await findVotingDataById(id);
  if (!data) {
    throw new EntityNotFoundError({
      message: `Voting data with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return data;
};

export const createNewVotingData = async (data: CreateVotingDataDto) => {
  return await createVotingData({
    borough: data.borough,
    year: data.year,
    party: data.party,
    percentage: data.percentage,
    source: data.source,
  });
};

export const bulkCreateVotingData = async (data: CreateVotingDataDto[]) => {
  return await createManyVotingData(
    data.map(item => ({
      borough: item.borough,
      year: item.year,
      party: item.party,
      percentage: item.percentage,
      source: item.source,
    }))
  );
};

export const updateVotingDataById = async (id: string, data: UpdateVotingDataDto) => {
  await getVotingDataById(id); // Throws 404 if missing

  const updateData: any = {
    borough: data.borough,
    year: data.year,
    party: data.party,
    percentage: data.percentage,
    source: data.source,
  };

  return await updateVotingData(id, updateData);
};

export const deleteVotingDataById = async (id: string) => {
  await getVotingDataById(id); // Throws 404 if missing
  return await deleteVotingData(id);
};
