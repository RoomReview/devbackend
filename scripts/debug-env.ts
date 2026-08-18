import { config } from 'dotenv';
import { join } from 'path';

const envPath = join(__dirname, '../.env');
config({ path: envPath, override: true });

console.log('envPath', envPath);
console.log('DATABASE_URL', process.env.DATABASE_URL);
