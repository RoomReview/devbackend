import { EntityNotFoundError } from '@/utils/custom-error';
import { buildPaginatedResult, paginate } from '@/utils/helpers';
import type { DataTable, DataFilters } from '@/repositories/data.repository';
import { countData, findAllData, findDataById } from '@/repositories/data.repository';

export const getAllData = async (
  table: DataTable,
  page: number,
  limit: number,
  filters: DataFilters = {},
) => {
  const { offset } = paginate(page, limit);
  const [data, total] = await Promise.all([
    findAllData(table, limit, offset, filters),
    countData(table, filters),
  ]);
  return buildPaginatedResult(data, total, page, limit);
};

export const getDataById = async (table: DataTable, id: string) => {
  const result = await findDataById(table, id);
  if (!result) {
    throw new EntityNotFoundError({
      message: `${table} record with ID ${id} not found`,
      code: 'ENTITY_NOT_FOUND',
    });
  }
  return result;
};
