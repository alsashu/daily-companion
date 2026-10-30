import type { Pool } from 'pg';
import type { EntryInput, Habits, ImportEntry, Mood, Task } from '../validation/entry';

export interface DailyEntry extends EntryInput {
  date: string;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Data access for daily entries. The routes depend on this interface so tests can swap it out. */
export interface EntryRepository {
  getByDate(date: string): Promise<DailyEntry | null>;
  upsert(date: string, input: EntryInput): Promise<DailyEntry>;
  listByMonth(month: string): Promise<DailyEntry[]>;
  listAll(): Promise<DailyEntry[]>;
  /** Upserts every entry in one transaction; nothing is written if any statement fails. */
  importEntries(entries: ImportEntry[]): Promise<number>;
  ping(): Promise<void>;
}

export function emptyEntry(date: string): DailyEntry {
  return { date, tasks: [], mood: null, journal: '', habits: {}, createdAt: null, updatedAt: null };
}

interface EntryRow {
  entry_date: string;
  tasks: Task[];
  mood: Mood | null;
  journal: string | null;
  habits: Habits;
  created_at: Date;
  updated_at: Date;
}

// to_char keeps the date as a plain string, avoiding time zone shifts from JS Date parsing.
const COLUMNS = `to_char(entry_date, 'YYYY-MM-DD') AS entry_date, tasks, mood, journal, habits, created_at, updated_at`;

const UPSERT_SQL = `
  INSERT INTO daily_entries (entry_date, tasks, mood, journal, habits)
  VALUES ($1, $2::jsonb, $3, $4, $5::jsonb)
  ON CONFLICT (entry_date) DO UPDATE SET
    tasks = EXCLUDED.tasks,
    mood = EXCLUDED.mood,
    journal = EXCLUDED.journal,
    habits = EXCLUDED.habits,
    updated_at = NOW()
  RETURNING ${COLUMNS}`;

function toEntry(row: EntryRow): DailyEntry {
  return {
    date: row.entry_date,
    tasks: row.tasks,
    mood: row.mood,
    journal: row.journal ?? '',
    habits: row.habits,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// JSONB parameters must be serialized explicitly; pg would otherwise send arrays as PostgreSQL arrays.
function upsertParams(date: string, input: EntryInput) {
  return [date, JSON.stringify(input.tasks), input.mood, input.journal, JSON.stringify(input.habits)];
}

export function createPgRepository(pool: Pool): EntryRepository {
  return {
    async getByDate(date) {
      const { rows } = await pool.query<EntryRow>(
        `SELECT ${COLUMNS} FROM daily_entries WHERE entry_date = $1`,
        [date],
      );
      return rows[0] ? toEntry(rows[0]) : null;
    },

    async upsert(date, input) {
      const { rows } = await pool.query<EntryRow>(UPSERT_SQL, upsertParams(date, input));
      return toEntry(rows[0]);
    },

    async listByMonth(month) {
      const { rows } = await pool.query<EntryRow>(
        `SELECT ${COLUMNS} FROM daily_entries
         WHERE entry_date >= $1::date AND entry_date < ($1::date + INTERVAL '1 month')
         ORDER BY entry_date`,
        [`${month}-01`],
      );
      return rows.map(toEntry);
    },

    async listAll() {
      const { rows } = await pool.query<EntryRow>(
        `SELECT ${COLUMNS} FROM daily_entries ORDER BY entry_date`,
      );
      return rows.map(toEntry);
    },

    async importEntries(entries) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const entry of entries) {
          await client.query(UPSERT_SQL, upsertParams(entry.date, entry));
        }
        await client.query('COMMIT');
        return entries.length;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },

    async ping() {
      await pool.query('SELECT 1');
    },
  };
}
