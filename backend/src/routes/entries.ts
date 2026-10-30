import { Router, type NextFunction, type Request, type Response } from 'express';
import { emptyEntry, type EntryRepository } from '../services/entriesService';
import { isValidDate, isValidMonth, validateEntryInput, validateImport } from '../validation/entry';

type AsyncHandler = (req: Request, res: Response) => Promise<unknown>;

// Express 4 does not forward rejected promises to the error handler on its own.
export const asyncHandler =
  (handler: AsyncHandler) => (req: Request, res: Response, next: NextFunction) =>
    handler(req, res).catch(next);

function badRequest(res: Response, error: string, details?: string[]) {
  return res.status(400).json(details ? { error, details } : { error });
}

export function createEntriesRouter(repo: EntryRepository): Router {
  const router = Router();

  router.get(
    '/entries',
    asyncHandler(async (req, res) => {
      const { month } = req.query;
      if (!isValidMonth(month)) {
        return badRequest(res, 'Query parameter "month" is required in YYYY-MM format');
      }
      res.json({ month, entries: await repo.listByMonth(month) });
    }),
  );

  router.get(
    '/entries/:date',
    asyncHandler(async (req, res) => {
      const { date } = req.params;
      if (!isValidDate(date)) return badRequest(res, 'Date must be a valid date in YYYY-MM-DD format');
      // Missing dates get a default entry; no row is created until something is saved.
      res.json((await repo.getByDate(date)) ?? emptyEntry(date));
    }),
  );

  router.put(
    '/entries/:date',
    asyncHandler(async (req, res) => {
      const { date } = req.params;
      if (!isValidDate(date)) return badRequest(res, 'Date must be a valid date in YYYY-MM-DD format');
      const result = validateEntryInput(req.body);
      if (!result.ok) return badRequest(res, 'Invalid entry', result.errors);
      res.json(await repo.upsert(date, result.value));
    }),
  );

  router.get(
    '/export',
    asyncHandler(async (_req, res) => {
      const entries = await repo.listAll();
      res.json({ app: 'daily-companion', version: 1, exportedAt: new Date().toISOString(), entries });
    }),
  );

  router.post(
    '/import',
    asyncHandler(async (req, res) => {
      const result = validateImport(req.body);
      if (!result.ok) return badRequest(res, 'Invalid backup; no data was imported', result.errors);
      const imported = await repo.importEntries(result.value);
      res.json({
        imported,
        message: `Imported ${imported} entries. Existing entries with matching dates were replaced.`,
      });
    }),
  );

  return router;
}
