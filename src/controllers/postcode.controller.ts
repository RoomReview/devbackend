import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as postcodeService from '@/services/postcode.service';
import type { CreatePostcodeDto, UpdatePostcodeDto } from '@/dto/postcode.dto';

export const getAllPostcodes = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const filter = {
    outcode: req.query.outcode as string,
    boroughId: req.query.boroughId as string,
  };

  const { data, pagination } = await postcodeService.getAllPostcodes(page, limit, filter);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'Postcodes fetched successfully',
  };
  res.status(200).json(response);
};

export const getPostcodeById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const id = String(req.params.id);
  const data = await postcodeService.getPostcodeById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Postcode fetched successfully',
  };
  res.status(200).json(response);
};

export const getPostcodeByCode = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const code = String(req.params.code);
  const data = await postcodeService.getPostcodeByCode(code);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Postcode fetched successfully by code',
  };
  res.status(200).json(response);
};

export const getPostcodeReportDataByCode = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const code = String(req.params.code);
  const data = await postcodeService.getPostcodeReportDataByCode(code);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Postcode report data fetched successfully',
  };
  res.status(200).json(response);
};

export const createPostcode = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await postcodeService.createNewPostcode(req.body as CreatePostcodeDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Postcode created successfully',
  };
  res.status(201).json(response);
};

export const updatePostcode = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const id = String(req.params.id);
  const data = await postcodeService.updatePostcodeById(id, req.body as UpdatePostcodeDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Postcode updated successfully',
  };
  res.status(200).json(response);
};

export const deletePostcode = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const id = String(req.params.id);
  await postcodeService.deletePostcodeById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Postcode deleted successfully',
  };
  res.status(200).json(response);
};
