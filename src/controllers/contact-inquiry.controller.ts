import type { Request, Response } from 'express';
import type { ApiResponse } from '@/types';
import * as contactInquiryService from '@/services/contact-inquiry.service';
import type { CreateContactInquiryDto, UpdateContactInquiryStatusDto } from '@/dto/contact-inquiry.dto';
import { InquiryStatus } from '@/generated/prisma/enums';

export const submitInquiry = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await contactInquiryService.submitInquiry(req.body as CreateContactInquiryDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 201,
    data,
    message: 'Inquiry submitted successfully. We will get back to you shortly.',
  };
  res.status(201).json(response);
};

export const getInquiryById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  const data = await contactInquiryService.getInquiryById(id);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Contact inquiry fetched successfully',
  };
  res.status(200).json(response);
};

export const getAllInquiries = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const status = req.query.status as InquiryStatus;

  const { data, pagination } = await contactInquiryService.getAllInquiries(page, limit, status);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    pagination,
    message: 'Contact inquiries fetched successfully',
  };
  res.status(200).json(response);
};

export const updateInquiryStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  const data = await contactInquiryService.updateInquiryStatus(id, req.body as UpdateContactInquiryStatusDto);

  const response: ApiResponse<typeof data> = {
    success: true,
    statusCode: 200,
    data,
    message: 'Contact inquiry status updated successfully',
  };
  res.status(200).json(response);
};

export const deleteInquiry = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as any;
  await contactInquiryService.deleteInquiryById(id);

  const response: ApiResponse<null> = {
    success: true,
    statusCode: 200,
    message: 'Contact inquiry deleted successfully',
  };
  res.status(200).json(response);
};
