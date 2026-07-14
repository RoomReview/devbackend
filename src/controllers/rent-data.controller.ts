import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as rentService from '@/services/rent-data.service';
import type { CreateRentDataDto, UpdateRentDataDto } from '@/dto/rent-data.dto';

export const getAllRentData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const filter = {
    postcode: req.query.postcode as string,
    propertyType: req.query.propertyType as string,
    bedrooms: req.query.bedrooms ? Number(req.query.bedrooms) : undefined,
  };

  const { data, pagination } = await rentService.getAllRentData(page, limit, filter);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'Rent data records fetched successfully',
  };
  res.status(200).json(response);
};

export const getRentDataById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  const data = await rentService.getRentDataById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Rent data record details fetched successfully',
  };
  res.status(200).json(response);
};

export const createRentData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await rentService.createNewRentData(req.body as CreateRentDataDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Rent data record created successfully',
  };
  res.status(201).json(response);
};

export const bulkCreateRentData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await rentService.bulkCreateRentData(req.body as CreateRentDataDto[]);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Rent data records imported successfully',
  };
  res.status(201).json(response);
};

export const updateRentData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  const data = await rentService.updateRentDataById(id, req.body as UpdateRentDataDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Rent data record updated successfully',
  };
  res.status(200).json(response);
};

export const deleteRentData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  await rentService.deleteRentDataById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Rent data record deleted successfully',
  };
  res.status(200).json(response);
};
