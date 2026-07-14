import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as votingService from '@/services/voting-data.service';
import type { CreateVotingDataDto, UpdateVotingDataDto } from '@/dto/voting-data.dto';

export const getAllVotingData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const filter = {
    borough: req.query.borough as string,
    year: req.query.year ? Number(req.query.year) : undefined,
    party: req.query.party as string,
  };

  const { data, pagination } = await votingService.getAllVotingData(page, limit, filter);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'Voting data records fetched successfully',
  };
  res.status(200).json(response);
};

export const getVotingDataById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await votingService.getVotingDataById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Voting data record details fetched successfully',
  };
  res.status(200).json(response);
};

export const createVotingData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await votingService.createNewVotingData(req.body as CreateVotingDataDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Voting data record created successfully',
  };
  res.status(201).json(response);
};

export const bulkCreateVotingData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await votingService.bulkCreateVotingData(req.body as CreateVotingDataDto[]);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Voting data records imported successfully',
  };
  res.status(201).json(response);
};

export const updateVotingData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await votingService.updateVotingDataById(id, req.body as UpdateVotingDataDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Voting data record updated successfully',
  };
  res.status(200).json(response);
};

export const deleteVotingData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  await votingService.deleteVotingDataById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Voting data record deleted successfully',
  };
  res.status(200).json(response);
};
