import {
  createAgency,
  findAgencyById,
  findAgencyByEmail,
  findAgencyByName,
  findAllAgencies,
  countAgencies,
  updateAgency,
  deleteAgency,
  findUserAgenciesByAgencyId,
  findUserAgencyByUserAndAgency,
  updateUserAgencyVerifyStatus,
} from '@/repositories/agencies.repository';
import { EntityNotFoundError, ForbiddenError, ValidationError } from '@/utils/custom-error';
import type { CreateAgencyDto, UpdateAgencyDto, VerifyAgencyDto } from '@/dto/agency.dto';
import { paginate } from '@/utils/helpers';
import { UserRole } from '@/generated/prisma/enums';

export const getAllAgencies = async (page: number, limit: number) => {
  const { offset } = paginate(page, limit);
  const items = await findAllAgencies(limit, offset);
  const total = await countAgencies();
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

export const getAgencyById = async (id: string) => {
  const agency = await findAgencyById(id);
  if (!agency) {
    throw new EntityNotFoundError({
      message: `Agency with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return agency;
};

export const createNewAgency = async (data: CreateAgencyDto) => {
  if (data.email) {
    const existingEmail = await findAgencyByEmail(data.email);
    if (existingEmail) {
      throw new ValidationError({
        message: `Agency with email ${data.email} already exists`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  const existingName = await findAgencyByName(data.name);
  if (existingName) {
    throw new ValidationError({
      message: `Agency with name ${data.name} already exists`,
      code: 'VALIDATION_ERROR',
    });
  }

  return await createAgency({
    name: data.name,
    description: data.description,
    email: data.email,
    phone: data.phone,
    website: data.website,
    isVerified: false,
  });
};

export const updateAgencyById = async (
  id: string,
  data: UpdateAgencyDto,
  userId: string,
  userRole: string,
) => {
  const agency = await getAgencyById(id); // Throws 404 if missing

  // Authorization check: Only connected agents or Admin can update
  if (userRole !== UserRole.ADMIN) {
    const link = await findUserAgencyByUserAndAgency(userId, id);
    if (!link) {
      throw new ForbiddenError({
        message: 'You are not authorized to update this agency profile',
        code: 'VALIDATION_ERROR',
      });
    }
  }

  if (data.email && data.email !== agency.email) {
    const existingEmail = await findAgencyByEmail(data.email);
    if (existingEmail) {
      throw new ValidationError({
        message: `Agency with email ${data.email} already exists`,
        code: 'VALIDATION_ERROR',
      });
    }
  }

  return await updateAgency(id, {
    name: data.name,
    description: data.description,
    email: data.email,
    phone: data.phone,
    website: data.website,
  });
};

export const verifyAgencyById = async (id: string, data: VerifyAgencyDto) => {
  await getAgencyById(id); // Throws 404 if missing
  return await updateAgency(id, {
    isVerified: data.isVerified,
  });
};

export const deleteAgencyById = async (id: string) => {
  await getAgencyById(id); // Throws 404 if missing
  return await deleteAgency(id);
};

export const getAgencyAgents = async (agencyId: string) => {
  await getAgencyById(agencyId); // Throws 404 if missing
  const agents = await findUserAgenciesByAgencyId(agencyId);
  return { data: agents };
};

export const verifyAgentInAgency = async (
  agencyId: string,
  agentId: string,
  isVerified: boolean,
) => {
  const link = await findUserAgencyByUserAndAgency(agentId, agencyId);
  if (!link) {
    throw new EntityNotFoundError({
      message: 'Agent link to this agency not found',
      code: 'ENTITY_NOT_FOUND',
    });
  }

  return await updateUserAgencyVerifyStatus(agentId, agencyId, isVerified);
};
