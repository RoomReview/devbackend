import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as crimeService from '@/services/crime-data.service';
import type { CreateCrimeDataDto, UpdateCrimeDataDto } from '@/dto/crime-data.dto';

export const getAllCrimeData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const filter = {
    borough: req.query.borough as string,
    crimeType: req.query.crimeType as string,
  };

  const result = await crimeService.getAllCrimeData(page, limit, filter);

  const response: ApiResponse<typeof result> = {
    success: true,
    statusCode: 200,
    data: result,
    message: 'Crime data records fetched successfully',
  };
  res.status(200).json(response);
};

export const getCrimeDataById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await crimeService.getCrimeDataById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Crime data record details fetched successfully',
  };
  res.status(200).json(response);
};

export const createCrimeData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await crimeService.createNewCrimeData(req.body as CreateCrimeDataDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Crime data record created successfully',
  };
  res.status(201).json(response);
};

export const bulkCreateCrimeData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await crimeService.bulkCreateCrimeData(req.body as CreateCrimeDataDto[]);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Crime data records imported successfully',
  };
  res.status(201).json(response);
};

export const updateCrimeData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await crimeService.updateCrimeDataById(id, req.body as UpdateCrimeDataDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Crime data record updated successfully',
  };
  res.status(200).json(response);
};

export const deleteCrimeData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  await crimeService.deleteCrimeDataById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Crime data record deleted successfully',
  };
  res.status(200).json(response);
};
