import {
  createExperience,
  findExperienceById,
  findAllExperiences,
  countExperiences,
  updateExperience,
  deleteExperience,
  FindExperiencesFilter,
} from '@/repositories/experience.repository';
import { EntityNotFoundError, ForbiddenError, ValidationError } from '@/utils/custom-error';
import { findPostcodeById } from '@/repositories/postcode.repository';
import type { CreateExperienceDto, UpdateExperienceDto, UpdateExperienceStatusDto } from '@/dto/experience.dto';
import { paginate } from '@/utils/helpers';
import { ExperienceStatus, UserRole } from '@/generated/prisma/enums';

export const getAllExperiences = async (page: number, limit: number, filter?: FindExperiencesFilter) => {
  const { offset } = paginate(page, limit);
  const items = await findAllExperiences(limit, offset, filter);
  const total = await countExperiences(filter);
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

export const getExperienceById = async (id: string) => {
  const item = await findExperienceById(id);
  if (!item) {
    throw new EntityNotFoundError({
      message: `Experience with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return item;
};

export const createNewExperience = async (data: CreateExperienceDto, authorId: string | null) => {
  if (data.postcodeId) {
    const postcode = await findPostcodeById(data.postcodeId);
    if (!postcode) {
      throw new ValidationError({
        message: `Postcode with ID ${data.postcodeId} does not exist`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  return await createExperience({
    type: data.type,
    title: data.title,
    story: data.story,
    landlordName: data.landlordName,
    agentName: data.agentName,
    yearOfExperience: data.yearOfExperience,
    anonymous: data.anonymous ?? true,
    contactEmail: data.contactEmail,
    status: ExperienceStatus.PENDING,
    ...(authorId ? { author: { connect: { userId: authorId } } } : {}),
    ...(data.postcodeId ? { postcode: { connect: { postcodeId: data.postcodeId } } } : {}),
  });
};

export const updateExperienceById = async (
  id: string,
  data: UpdateExperienceDto,
  userId: string,
  userRole: string,
) => {
  const existing = await getExperienceById(id);

  // Authorization check: Only author or ADMIN can update
  if (existing.authorId !== userId && userRole !== UserRole.ADMIN) {
    throw new ForbiddenError({
      message: 'You are not authorized to update this experience',
      code: 'VALIDATION_ERROR',
    });
  }

  if (data.postcodeId) {
    const postcode = await findPostcodeById(data.postcodeId);
    if (!postcode) {
      throw new ValidationError({
        message: `Postcode with ID ${data.postcodeId} does not exist`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  return await updateExperience(id, {
    type: data.type,
    title: data.title,
    story: data.story,
    landlordName: data.landlordName,
    agentName: data.agentName,
    yearOfExperience: data.yearOfExperience,
    anonymous: data.anonymous,
    contactEmail: data.contactEmail,
    ...(data.postcodeId ? { postcode: { connect: { postcodeId: data.postcodeId } } } : {}),
  });
};

export const updateExperienceStatusById = async (id: string, data: UpdateExperienceStatusDto) => {
  await getExperienceById(id); // Throws 404 if missing

  const updateData: any = {
    status: data.status,
    adminNotes: data.adminNotes,
  };

  if (data.status === ExperienceStatus.APPROVED || data.status === ExperienceStatus.FEATURED) {
    updateData.publishedAt = new Date();
  }

  return await updateExperience(id, updateData);
};

export const deleteExperienceById = async (id: string, userId: string, userRole: string) => {
  const existing = await getExperienceById(id);

  // Authorization check: Only author or ADMIN can delete
  if (existing.authorId !== userId && userRole !== UserRole.ADMIN) {
    throw new ForbiddenError({
      message: 'You are not authorized to delete this experience',
      code: 'VALIDATION_ERROR',
    });
  }

  return await deleteExperience(id);
};
