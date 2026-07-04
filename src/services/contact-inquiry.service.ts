import {
  createInquiry,
  findInquiryById,
  findAllInquiries,
  countInquiries,
  updateInquiry,
  deleteInquiry,
} from '@/repositories/contact-inquiry.repository';
import { EntityNotFoundError } from '@/utils/custom-error';
import type { CreateContactInquiryDto, UpdateContactInquiryStatusDto } from '@/dto/contact-inquiry.dto';
import { paginate } from '@/utils/helpers';
import { InquiryStatus } from '@/generated/prisma/enums';

export const submitInquiry = async (data: CreateContactInquiryDto) => {
  return await createInquiry({
    name: data.name,
    email: data.email,
    subject: data.subject,
    message: data.message,
    status: InquiryStatus.NEW,
  });
};

export const getInquiryById = async (id: string) => {
  const inquiry = await findInquiryById(id);
  if (!inquiry) {
    throw new EntityNotFoundError({
      message: `Contact inquiry with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return inquiry;
};

export const getAllInquiries = async (page: number, limit: number, status?: InquiryStatus) => {
  const { offset } = paginate(page, limit);
  const items = await findAllInquiries(limit, offset, status);
  const total = await countInquiries(status);
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

export const updateInquiryStatus = async (id: string, data: UpdateContactInquiryStatusDto) => {
  await getInquiryById(id); // Throws 404 if missing

  return await updateInquiry(id, {
    status: data.status,
    adminNotes: data.adminNotes,
  });
};

export const deleteInquiryById = async (id: string) => {
  await getInquiryById(id); // Throws 404 if missing
  return await deleteInquiry(id);
};
