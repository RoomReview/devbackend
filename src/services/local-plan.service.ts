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
import { paginate, buildPaginatedResult } from '@/utils/helpers';

export const getAllLocalPlans = async (page: number, limit: number, filter?: FindLocalPlansFilter) => {
  const { offset } = paginate(page, limit);
  const [items, total] = await Promise.all([
    findAllLocalPlans(limit, offset, filter),
    countLocalPlans(filter),
  ]);
  return buildPaginatedResult(items, total, page, limit);
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
    category: data.category,
    summary: data.summary,
    indicator: data.indicator,
    forecastChange: data.forecastChange,
    source: data.source,
  });
};

export const updateLocalPlanById = async (id: string, data: UpdateLocalPlanDto) => {
  await getLocalPlanById(id); // Throws 404 if missing

  const updateData: any = {
    borough: data.borough,
    category: data.category,
    summary: data.summary,
    indicator: data.indicator,
    forecastChange: data.forecastChange,
    source: data.source,
  };

  return await updateLocalPlan(id, updateData);
};

export const deleteLocalPlanById = async (id: string) => {
  await getLocalPlanById(id); // Throws 404 if missing
  return await deleteLocalPlan(id);
};
