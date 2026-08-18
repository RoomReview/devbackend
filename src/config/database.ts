import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');

dotenv.config({ path: envPath, override: true });
// eslint-disable-next-line no-console
console.log(`Loaded backend environment from: ${envPath}`);

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const connectionString = `${process.env.DATABASE_URL}`;

const extractHostPort = (conn: string | undefined) => {
	try {
		if (!conn) return null;
		const m = conn.match(/@([^:/?#]+)(?::(\d+))?/);
		if (!m) return null;
		return { host: m[1], port: m[2] ?? '5432' };
	} catch {
		return null;
	}
};

const connInfo = extractHostPort(connectionString);
if (connInfo) {
	// eslint-disable-next-line no-console
	console.log(`Prisma DB host: ${connInfo.host}, port: ${connInfo.port}`);
} else {
	// eslint-disable-next-line no-console
	console.log('Prisma DB connection string not detected or could not be parsed');
}

if (!connectionString) {
	// eslint-disable-next-line no-console
	console.error('DATABASE_URL is not set. Please configure devbackend-main/.env correctly.');
	throw new Error('Missing DATABASE_URL');
}

if (!connectionString) {
	// eslint-disable-next-line no-console
	console.error('DATABASE_URL is not set. Please configure devbackend-main/.env correctly.');
	throw new Error('Missing DATABASE_URL');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter, log: ['query', 'error'] });

export default prisma;
