import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as boroughService from '@/services/borough.service';
import type { CreateBoroughDto, UpdateBoroughDto } from '@/dto/borough.dto';

export const getAllBoroughs = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const { data, pagination } = await boroughService.getAllBoroughs(page, limit);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'Boroughs fetched successfully',
  };
  res.status(200).json(response);
};

export const getBoroughById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await boroughService.getBoroughById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Borough fetched successfully',
  };
  res.status(200).json(response);
};

export const getBoroughBySlug = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { slug } = req.params;
  const data = await boroughService.getBoroughBySlug(slug);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Borough fetched successfully by slug',
  };
  res.status(200).json(response);
};

export const createBorough = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await boroughService.createNewBorough(req.body as CreateBoroughDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Borough created successfully',
  };
  res.status(201).json(response);
};

export const updateBorough = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  const data = await boroughService.updateBoroughById(id, req.body as UpdateBoroughDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Borough updated successfully',
  };
  res.status(200).json(response);
};

export const deleteBorough = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  await boroughService.deleteBoroughById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Borough deleted successfully',
  };
  res.status(200).json(response);
};
