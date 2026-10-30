import { Router } from 'express';
import type { EntryRepository } from '../services/entriesService';

export function createHealthRouter(repo: EntryRepository): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    try {
      await repo.ping();
      res.json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'error', database: 'down' });
    }
  });

  return router;
}
