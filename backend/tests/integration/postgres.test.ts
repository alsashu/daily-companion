// Runs against a real PostgreSQL database. Requires TEST_DATABASE_URL pointing at a
// DEDICATED test database: the daily_entries table is truncated before each test.
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { INIT_SQL_PATH } from '../../src/database/init';
import { createPool } from '../../src/database/pool';
import { createPgRepository } from '../../src/services/entriesService';

const url = process.env.TEST_DATABASE_URL;

const payload = {
  tasks: [{ id: 'task-1', text: 'Visit the park', completed: false }],
  mood: 'Good',
  journal: 'Had a productive day.',
  habits: { morningMeditation: true, exercise: false, read20Pages: true },
};

describe.skipIf(!url)('PostgreSQL integration', () => {
  let pool: Pool;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    pool = createPool(url as string);
    await pool.query(readFileSync(INIT_SQL_PATH, 'utf8'));
    app = createApp(createPgRepository(pool));
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE daily_entries RESTART IDENTITY');
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('creates exactly one application table', async () => {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    expect(rows.map((r) => r.table_name)).toEqual(['daily_entries']);
  });

  it('upserts a single row per date and bumps updated_at', async () => {
    const created = await request(app).put('/api/entries/2026-10-29').send(payload);
    expect(created.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const updated = await request(app)
      .put('/api/entries/2026-10-29')
      .send({ ...payload, mood: 'Excellent' });

    expect(updated.body.mood).toBe('Excellent');
    expect(updated.body.createdAt).toBe(created.body.createdAt);
    expect(new Date(updated.body.updatedAt).getTime()).toBeGreaterThan(new Date(created.body.updatedAt).getTime());

    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM daily_entries');
    expect(rows[0].count).toBe(1);
  });

  it('stores tasks and habits as JSONB', async () => {
    await request(app).put('/api/entries/2026-10-29').send(payload);
    const { rows } = await pool.query(
      `SELECT jsonb_typeof(tasks) AS t, jsonb_typeof(habits) AS h, habits->>'read20Pages' AS read
       FROM daily_entries`,
    );
    expect(rows[0]).toEqual({ t: 'array', h: 'object', read: 'true' });
  });

  it('returns month entries without date shifting', async () => {
    await request(app).put('/api/entries/2026-10-01').send(payload);
    await request(app).put('/api/entries/2026-10-31').send(payload);
    await request(app).put('/api/entries/2026-11-01').send(payload);
    const res = await request(app).get('/api/entries?month=2026-10');
    expect(res.body.entries.map((e: { date: string }) => e.date)).toEqual(['2026-10-01', '2026-10-31']);
  });

  it('imports transactionally and rolls back on database errors', async () => {
    await request(app).put('/api/entries/2026-10-29').send(payload);

    const ok = await request(app)
      .post('/api/import')
      .send({ entries: [{ date: '2026-10-29', ...payload, mood: 'Bad' }, { date: '2026-10-30', ...payload }] });
    expect(ok.status).toBe(200);
    expect((await request(app).get('/api/entries/2026-10-29')).body.mood).toBe('Bad');

    // Simulate a failure halfway through by dropping a constraint-violating row past validation.
    const repo = createPgRepository(pool);
    await expect(
      repo.importEntries([
        { date: '2026-12-01', ...payload, mood: null },
        { date: '2026-12-02', ...payload, mood: 'NotAMood' as never },
      ]),
    ).rejects.toThrow();
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM daily_entries WHERE entry_date >= '2026-12-01'`);
    expect(rows[0].count).toBe(0);
  });
});
