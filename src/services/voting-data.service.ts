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
import { paginate } from '@/utils/helpers';

export const getAllVotingData = async (page: number, limit: number, filter?: FindVotingDataFilter) => {
  const { offset } = paginate(page, limit);
  const items = await findAllVotingData(limit, offset, filter);
  const total = await countVotingData(filter);
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
    wardName: data.wardName,
    year: data.year,
    party: data.party,
    votes: data.votes,
    percentage: data.percentage,
  });
};

export const bulkCreateVotingData = async (data: CreateVotingDataDto[]) => {
  return await createManyVotingData(
    data.map(item => ({
      borough: item.borough,
      wardName: item.wardName,
      year: item.year,
      party: item.party,
      votes: item.votes,
      percentage: item.percentage,
    }))
  );
};

export const updateVotingDataById = async (id: string, data: UpdateVotingDataDto) => {
  await getVotingDataById(id); // Throws 404 if missing

  const updateData: any = {
    borough: data.borough,
    wardName: data.wardName,
    year: data.year,
    party: data.party,
    votes: data.votes,
    percentage: data.percentage,
  };

  return await updateVotingData(id, updateData);
};

export const deleteVotingDataById = async (id: string) => {
  await getVotingDataById(id); // Throws 404 if missing
  return await deleteVotingData(id);
};
