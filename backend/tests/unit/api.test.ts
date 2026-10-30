import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { createFakeRepository } from './fakeRepository';

const payload = {
  tasks: [{ id: 'task-1', text: 'Visit the park', completed: false }],
  mood: 'Good',
  journal: 'Had a productive day.',
  habits: { morningMeditation: true, exercise: false, read20Pages: true },
};

function setup(options?: { failImportAt?: number }) {
  const { repo, store } = createFakeRepository(options);
  return { app: createApp(repo), store };
}

describe('GET /api/health', () => {
  it('reports ok when the database responds', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });
});

describe('entries', () => {
  it('returns a default entry for a date with no data, without creating it', async () => {
    const { app, store } = setup();
    const res = await request(app).get('/api/entries/2026-10-29');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ date: '2026-10-29', tasks: [], mood: null, journal: '', habits: {} });
    expect(store.size).toBe(0);
  });

  it('creates and then updates an entry', async () => {
    const { app, store } = setup();
    const created = await request(app).put('/api/entries/2026-10-29').send(payload);
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ date: '2026-10-29', ...payload });

    const updatedPayload = { ...payload, tasks: [{ ...payload.tasks[0], completed: true }], mood: 'Excellent' };
    const updated = await request(app).put('/api/entries/2026-10-29').send(updatedPayload);
    expect(updated.status).toBe(200);
    expect(updated.body.tasks[0].completed).toBe(true);
    expect(store.size).toBe(1);

    const loaded = await request(app).get('/api/entries/2026-10-29');
    expect(loaded.body).toMatchObject(updatedPayload);
  });

  it.each(['2026-02-30', '2026-13-01', 'not-a-date'])('rejects invalid date %s', async (date) => {
    const { app } = setup();
    expect((await request(app).get(`/api/entries/${date}`)).status).toBe(400);
    expect((await request(app).put(`/api/entries/${date}`).send(payload)).status).toBe(400);
  });

  it('rejects invalid payloads with details', async () => {
    const { app, store } = setup();
    const res = await request(app).put('/api/entries/2026-10-29').send({ ...payload, mood: 'Ecstatic' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid entry');
    expect(res.body.details[0]).toMatch(/mood/);
    expect(store.size).toBe(0);
  });

  it('rejects malformed JSON', async () => {
    const { app } = setup();
    const res = await request(app)
      .put('/api/entries/2026-10-29')
      .set('Content-Type', 'application/json')
      .send('{"tasks": [');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid JSON/);
  });

  it('lists entries for a month', async () => {
    const { app } = setup();
    await request(app).put('/api/entries/2026-10-01').send(payload);
    await request(app).put('/api/entries/2026-10-31').send(payload);
    await request(app).put('/api/entries/2026-11-01').send(payload);

    const res = await request(app).get('/api/entries?month=2026-10');
    expect(res.status).toBe(200);
    expect(res.body.entries.map((e: { date: string }) => e.date)).toEqual(['2026-10-01', '2026-10-31']);
    expect((await request(app).get('/api/entries')).status).toBe(400);
    expect((await request(app).get('/api/entries?month=2026-13')).status).toBe(400);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

describe('export and import', () => {
  it('exports all entries as a JSON backup', async () => {
    const { app } = setup();
    await request(app).put('/api/entries/2026-10-29').send(payload);
    const res = await request(app).get('/api/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ app: 'daily-companion', version: 1 });
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0]).toMatchObject({ date: '2026-10-29', ...payload });
  });

  it('imports a valid backup, replacing matching dates', async () => {
    const { app } = setup();
    await request(app).put('/api/entries/2026-10-29').send(payload);
    const backup = {
      entries: [
        { date: '2026-10-29', tasks: [], mood: 'Bad', journal: 'Replaced', habits: {} },
        { date: '2026-10-30', ...payload },
      ],
    };
    const res = await request(app).post('/api/import').send(backup);
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(2);

    const replaced = await request(app).get('/api/entries/2026-10-29');
    expect(replaced.body).toMatchObject({ mood: 'Bad', journal: 'Replaced', tasks: [] });
  });

  it('round-trips an export through import', async () => {
    const { app } = setup();
    await request(app).put('/api/entries/2026-10-29').send(payload);
    const exported = await request(app).get('/api/export');
    const res = await request(app).post('/api/import').send(exported.body);
    expect(res.status).toBe(200);
  });

  it('rejects an invalid import without changing existing data', async () => {
    const { app, store } = setup();
    await request(app).put('/api/entries/2026-10-29').send(payload);
    const before = structuredClone([...store.entries()]);

    const res = await request(app)
      .post('/api/import')
      .send({ entries: [{ date: '2026-10-29', ...payload, mood: null }, { date: '2026-02-30', ...payload }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no data was imported/);
    expect([...store.entries()]).toEqual(before);
  });

  it('leaves data unchanged when the import transaction fails', async () => {
    const { app, store } = setup({ failImportAt: 1 });
    const res = await request(app)
      .post('/api/import')
      .send({ entries: [{ date: '2026-10-01', ...payload }, { date: '2026-10-02', ...payload }] });
    expect(res.status).toBe(500);
    expect(store.size).toBe(0);
  });
});
