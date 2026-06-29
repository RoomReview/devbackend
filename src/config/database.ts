import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import logger from '@utils/logger.js';

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter, log: ['query', 'error'] });

prisma.$on('query', (e) => {
  logger.info({ service: 'Database', function: 'query' }, 'Duration: ' + e.duration + 'ms');
});
export default prisma;
