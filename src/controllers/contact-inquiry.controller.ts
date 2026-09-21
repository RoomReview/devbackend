import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';

export const getAllContactInquiries = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Contact inquiries fetched successfully' };
  res.status(200).json(response);
};

export const getContactInquiryById = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Contact inquiry fetched successfully' };
  res.status(200).json(response);
};

export const createContactInquiry = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 201, data: null, message: 'Contact inquiry created successfully' };
  res.status(201).json(response);
};

export const updateContactInquiry = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Contact inquiry updated successfully' };
  res.status(200).json(response);
};

export const deleteContactInquiry = async (_req: Request, res: Response): Promise<void> => {
  const response: ApiResponse<null> = { success: true, statusCode: 200, data: null, message: 'Contact inquiry deleted successfully' };
  res.status(200).json(response);
};
