import { createApp } from './app';
import { createPool } from './database/pool';
import { createPgRepository } from './services/entriesService';

const port = Number(process.env.PORT ?? 5000);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required. Copy .env.example to .env and set it.');
  process.exit(1);
}

const pool = createPool(databaseUrl);
const app = createApp(createPgRepository(pool));

const server = app.listen(port, () => {
  console.log(`Daily Companion API listening on port ${port}`);
});

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  // Force exit if open connections keep the server from closing.
  setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async (err) => {
    await pool.end().catch(() => undefined);
    process.exit(err ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
