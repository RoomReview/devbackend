import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as demoService from '@/services/demography.service';
import type { CreateDemographyDto, UpdateDemographyDto } from '@/dto/demography.dto';

export const getAllDemography = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const filter = {
    postcode: req.query.postcode as string,
  };

  const { data, pagination } = await demoService.getAllDemography(page, limit, filter);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'Demography records fetched successfully',
  };
  res.status(200).json(response);
};

export const getDemographyById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await demoService.getDemographyById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Demography record details fetched successfully',
  };
  res.status(200).json(response);
};

export const createDemography = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await demoService.createNewDemography(req.body as CreateDemographyDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Demography record created successfully',
  };
  res.status(201).json(response);
};

export const bulkCreateDemography = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await demoService.bulkCreateDemography(req.body as CreateDemographyDto[]);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Demography records imported successfully',
  };
  res.status(201).json(response);
};

export const updateDemography = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await demoService.updateDemographyById(id, req.body as UpdateDemographyDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Demography record updated successfully',
  };
  res.status(200).json(response);
};

export const deleteDemography = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  await demoService.deleteDemographyById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Demography record deleted successfully',
  };
  res.status(200).json(response);
};
