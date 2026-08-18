import { config as loadDotenv } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { BigQuery } from '@google-cloud/bigquery';
import prisma from '../src/config/database.js';
import {
  createManyData,
  deleteAllData,
  type DataTable,
} from '../src/repositories/data.repository.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
loadDotenv({ path: join(__dirname, '../.env'), override: true });

const projectId = process.env.BIGQUERY_PROJECT_ID;
const dataset = process.env.BIGQUERY_DATASET;
const keyFilePath = process.env.BIGQUERY_KEYFILE_PATH;
const location = process.env.BIGQUERY_LOCATION ?? 'US';

if (!projectId) {
  throw new Error('BIGQUERY_PROJECT_ID is required to sync data from BigQuery');
}

if (!dataset) {
  throw new Error('BIGQUERY_DATASET is required to sync data from BigQuery');
}

const bigquery = new BigQuery({
  projectId,
  ...(keyFilePath ? { keyFilename: keyFilePath } : {}),
});

const tables: DataTable[] = [
  'crime_data',
  'demography',
  'property_value_data',
  'rent_data',
  'voting_data',
];

const normalizeRow = (row: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (value instanceof Date) {
        return [key, value.toISOString()];
      }
      if (value && typeof value === 'object' && 'value' in value) {
        return [key, (value as { value: unknown }).value];
      }
      return [key, value];
    }),
  );
};

const syncTable = async (table: DataTable) => {
  const query = `SELECT * FROM \`${projectId}.${dataset}.${table}\``;
  logger.info({ service: 'BigQuerySync', function: 'syncTable' }, `Querying BigQuery table ${table}`);

  const [rows] = await bigquery.query({ query, location });
  const normalizedRows = (rows as Record<string, unknown>[]).map(normalizeRow);

  logger.info(
    { service: 'BigQuerySync', function: 'syncTable' },
    `Fetched ${normalizedRows.length} rows from BigQuery table ${table}`,
  );

  if (normalizedRows.length === 0) {
    logger.warn({ service: 'BigQuerySync', function: 'syncTable' }, `No rows found for table ${table}`);
    return;
  }

  await deleteAllData(table);
  await createManyData(table, normalizedRows);
  logger.info({ service: 'BigQuerySync', function: 'syncTable' }, `Synchronized ${table} into Postgres`);
};

const main = async () => {
  try {
    for (const table of tables) {
      await syncTable(table);
    }
    logger.info({ service: 'BigQuerySync', function: 'main' }, 'BigQuery sync finished successfully');
  } catch (error) {
    logger.error({ service: 'BigQuerySync', function: 'main' }, 'BigQuery sync failed', {
      error,
    });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

main();
