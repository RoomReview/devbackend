import {
  createLocalPlan,
  findLocalPlanById,
  findAllLocalPlans,
  countLocalPlans,
  updateLocalPlan,
  deleteLocalPlan,
  FindLocalPlansFilter,
} from '@/repositories/local-plan.repository';
import { EntityNotFoundError } from '@/utils/custom-error';
import type { CreateLocalPlanDto, UpdateLocalPlanDto } from '@/dto/local-plan.dto';
import { paginate } from '@/utils/helpers';

export const getAllLocalPlans = async (page: number, limit: number, filter?: FindLocalPlansFilter) => {
  const { offset } = paginate(page, limit);
  const items = await findAllLocalPlans(limit, offset, filter);
  const total = await countLocalPlans(filter);
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

export const getLocalPlanById = async (id: string) => {
  const plan = await findLocalPlanById(id);
  if (!plan) {
    throw new EntityNotFoundError({
      message: `Local plan with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return plan;
};

export const createNewLocalPlan = async (data: CreateLocalPlanDto) => {
  return await createLocalPlan({
    borough: data.borough,
    title: data.title,
    documentUrl: data.documentUrl,
    adoptionDate: new Date(data.adoptionDate),
    status: data.status,
    category: data.category,
    summary: data.summary,
  });
};

export const updateLocalPlanById = async (id: string, data: UpdateLocalPlanDto) => {
  await getLocalPlanById(id); // Throws 404 if missing

  const updateData: any = {
    borough: data.borough,
    title: data.title,
    documentUrl: data.documentUrl,
    adoptionDate: data.adoptionDate ? new Date(data.adoptionDate) : undefined,
    status: data.status,
    category: data.category,
    summary: data.summary,
  };

  return await updateLocalPlan(id, updateData);
};

export const deleteLocalPlanById = async (id: string) => {
  await getLocalPlanById(id); // Throws 404 if missing
  return await deleteLocalPlan(id);
};
