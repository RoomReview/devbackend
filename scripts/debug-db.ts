import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env');
config({ path: envPath, override: true });

console.log('envPath', envPath);
console.log('DATABASE_URL', process.env.DATABASE_URL);

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  try {
    console.log('Connecting to Postgres...');
    await client.connect();
    console.log('Connected');
    const res = await client.query('SELECT 1 AS ok');
    console.log('Query result', res.rows);
  } catch (err) {
    console.error('Postgres error', err);
  } finally {
    await client.end();
  }
}

main();
