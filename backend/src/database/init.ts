// Applies database/init.sql to DATABASE_URL. Used for local development (`npm run db:init`).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createPool } from './pool';

export const INIT_SQL_PATH = path.resolve(__dirname, '../../../database/init.sql');

export async function initDatabase(connectionString: string): Promise<void> {
  const pool = createPool(connectionString);
  try {
    await pool.query(readFileSync(INIT_SQL_PATH, 'utf8'));
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  initDatabase(url)
    .then(() => console.log('Schema initialized: daily_entries is ready.'))
    .catch((err: Error) => {
      console.error('Schema initialization failed:', err.message);
      process.exit(1);
    });
}
