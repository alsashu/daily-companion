import { Pool } from 'pg';

export function createPool(connectionString: string): Pool {
  const pool = new Pool({ connectionString, max: 10 });
  // An idle client losing its connection must not crash the process; the pool replaces it.
  pool.on('error', (err) => console.error('Unexpected PostgreSQL client error:', err.message));
  return pool;
}
