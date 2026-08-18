import logger, { LogContext } from '@/utils/logger';
import prisma from '@config/database';

export type DataTable =
  | 'crime_data'
  | 'demography'
  | 'property_value_data'
  | 'rent_data'
  | 'voting_data';

export interface DataFilters {
  [key: string]: unknown;
}

const tableIdField: Record<DataTable, string> = {
  crime_data: 'crime_data_id',
  demography: 'demography_id',
  property_value_data: 'property_value_data_id',
  rent_data: 'rent_data_id',
  voting_data: 'voting_data_id',
};

const logContext: LogContext = {
  service: 'DataRepository',
  function: '',
};

const getModelClient = (table: DataTable, client: typeof prisma = prisma) => {
  const modelClient = (client as any)[table];
  if (!modelClient) {
    throw new Error(`Prisma model for table ${table} is not available`);
  }
  return modelClient as {
    findUnique: (args: Record<string, unknown>) => Promise<unknown>;
    findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
    deleteMany: (args: Record<string, unknown>) => Promise<unknown>;
    createMany: (args: Record<string, unknown>) => Promise<unknown>;
  };
};

export const findDataById = async (table: DataTable, id: string) => {
  return await getModelClient(table)
    .findUnique({ where: { [tableIdField[table]]: id } })
    .catch((err: unknown) => {
      logContext.function = 'findDataById';
      logger.error(logContext, 'Error in findDataById repository', { error: err, table, id });
      throw new Error('DB: findDataById operation failed');
    });
};

export const findAllData = async (
  table: DataTable,
  limit: number,
  offset: number,
  filters: DataFilters = {},
) => {
  return await getModelClient(table)
    .findMany({
      where: filters,
      take: limit,
      skip: offset,
      orderBy: { [tableIdField[table]]: 'asc' } as Record<string, 'asc' | 'desc'>,
    })
    .catch((err: unknown) => {
      logContext.function = 'findAllData';
      logger.error(logContext, 'Error in findAllData repository', { error: err, table, limit, offset, filters });
      throw new Error('DB: findAllData operation failed');
    });
};

export const countData = async (table: DataTable, filters: DataFilters = {}) => {
  return await getModelClient(table)
    .count({ where: filters })
    .catch((err: unknown) => {
      logContext.function = 'countData';
      logger.error(logContext, 'Error in countData repository', { error: err, table, filters });
      throw new Error('DB: countData operation failed');
    });
};

export const findLatestData = async (
  table: DataTable,
  filters: DataFilters = {},
  orderByField: string = 'date',
  direction: 'asc' | 'desc' = 'desc',
  take: number = 20,
) => {
  return await getModelClient(table)
    .findMany({
      where: filters,
      orderBy: { [orderByField]: direction } as Record<string, 'asc' | 'desc'>,
      take,
    })
    .catch((err: unknown) => {
      logContext.function = 'findLatestData';
      logger.error(logContext, 'Error in findLatestData repository', { error: err, table, filters, orderByField, direction, take });
      throw new Error('DB: findLatestData operation failed');
    });
};

export const deleteAllData = async (table: DataTable) => {
  return await getModelClient(table)
    .deleteMany({})
    .catch((err: unknown) => {
      logContext.function = 'deleteAllData';
      logger.error(logContext, 'Error in deleteAllData repository', { error: err, table });
      throw new Error('DB: deleteAllData operation failed');
    });
};

export const createManyData = async (table: DataTable, data: unknown[]) => {
  return await getModelClient(table)
    .createMany({ data, skipDuplicates: true })
    .catch((err: unknown) => {
      logContext.function = 'createManyData';
      logger.error(logContext, 'Error in createManyData repository', { error: err, table, count: data.length });
      throw new Error('DB: createManyData operation failed');
    });
};
