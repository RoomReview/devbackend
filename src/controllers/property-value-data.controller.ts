import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as valService from '@/services/property-value-data.service';
import type { CreatePropertyValueDataDto, UpdatePropertyValueDataDto } from '@/dto/property-value-data.dto';

export const getAllPropertyValueData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const filter = {
    postcode: req.query.postcode as string,
  };

  const result = await valService.getAllPropertyValueData(page, limit, filter);

  const response: ApiResponse<typeof result> = {
    success: true,
    statusCode: 200,
    data: result,
    message: 'Property value data records fetched successfully',
  };
  res.status(200).json(response);
};

export const getPropertyValueDataById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await valService.getPropertyValueDataById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Property value data record details fetched successfully',
  };
  res.status(200).json(response);
};

export const createPropertyValueData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await valService.createNewPropertyValueData(req.body as CreatePropertyValueDataDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Property value data record created successfully',
  };
  res.status(201).json(response);
};

export const bulkCreatePropertyValueData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await valService.bulkCreatePropertyValueData(req.body as CreatePropertyValueDataDto[]);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Property value data records imported successfully',
  };
  res.status(201).json(response);
};

export const updatePropertyValueData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await valService.updatePropertyValueDataById(id, req.body as UpdatePropertyValueDataDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Property value data record updated successfully',
  };
  res.status(200).json(response);
};

export const deletePropertyValueData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  await valService.deletePropertyValueDataById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Property value data record deleted successfully',
  };
  res.status(200).json(response);
};
