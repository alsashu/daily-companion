import express, { type NextFunction, type Request, type Response } from 'express';
import { createEntriesRouter } from './routes/entries';
import { createHealthRouter } from './routes/health';
import type { EntryRepository } from './services/entriesService';

interface HttpError extends Error {
  status?: number;
  type?: string;
}

export function createApp(repo: EntryRepository) {
  const app = express();
  app.disable('x-powered-by');
  // Large enough for a few years of backups imported in one request.
  app.use(express.json({ limit: '5mb' }));

  app.use('/api', createHealthRouter(repo), createEntriesRouter(repo));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body must be valid JSON' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large' });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
