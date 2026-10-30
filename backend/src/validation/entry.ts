export const MOODS = ['Excellent', 'Good', 'Average', 'Poor', 'Bad'] as const;
export type Mood = (typeof MOODS)[number];

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export type Habits = Record<string, boolean>;

/** The editable content of a daily entry (what PUT /api/entries/:date accepts). */
export interface EntryInput {
  tasks: Task[];
  mood: Mood | null;
  journal: string;
  habits: Habits;
}

export interface ImportEntry extends EntryInput {
  date: string;
}

export const LIMITS = {
  tasks: 200,
  taskId: 100,
  taskText: 500,
  journal: 10_000,
  habits: 50,
  importEntries: 10_000,
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const HABIT_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,49}$/;

const ENTRY_KEYS = ['tasks', 'mood', 'journal', 'habits'];
// Exported entries also carry these read-only fields; they are accepted and ignored on import.
const IMPORT_ENTRY_KEYS = [...ENTRY_KEYS, 'date', 'createdAt', 'updatedAt'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30, 2026-13-01, ...). */
export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** True for a month in YYYY-MM form. */
export function isValidMonth(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = MONTH_RE.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return Number(match[1]) >= 1000 && month >= 1 && month <= 12;
}

export function validateEntryInput(
  body: unknown,
  prefix = '',
  allowedKeys: string[] = ENTRY_KEYS,
): ValidationResult<EntryInput> {
  const field = (name: string) => (prefix ? `${prefix}.${name}` : name);
  if (!isPlainObject(body)) {
    return { ok: false, errors: [`${prefix || 'Request body'} must be a JSON object`] };
  }

  const errors: string[] = [];

  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) errors.push(`${field(key)} is not a recognized field`);
  }

  const tasks: Task[] = [];
  const rawTasks = body.tasks ?? [];
  if (!Array.isArray(rawTasks)) {
    errors.push(`${field('tasks')} must be an array`);
  } else if (rawTasks.length > LIMITS.tasks) {
    errors.push(`${field('tasks')} must contain at most ${LIMITS.tasks} tasks`);
  } else {
    const seenIds = new Set<string>();
    rawTasks.forEach((task: unknown, index: number) => {
      const path = `${field('tasks')}[${index}]`;
      if (!isPlainObject(task)) {
        errors.push(`${path} must be an object`);
        return;
      }
      const { id, text, completed } = task;
      let valid = true;
      if (typeof id !== 'string' || id.trim() === '' || id.length > LIMITS.taskId) {
        errors.push(`${path}.id must be a non-empty string of at most ${LIMITS.taskId} characters`);
        valid = false;
      } else if (seenIds.has(id)) {
        errors.push(`${path}.id "${id}" is duplicated`);
        valid = false;
      } else {
        seenIds.add(id);
      }
      if (typeof text !== 'string' || text.trim() === '' || text.length > LIMITS.taskText) {
        errors.push(`${path}.text must be a non-empty string of at most ${LIMITS.taskText} characters`);
        valid = false;
      }
      if (typeof completed !== 'boolean') {
        errors.push(`${path}.completed must be a boolean`);
        valid = false;
      }
      if (valid) tasks.push({ id: id as string, text: (text as string).trim(), completed: completed as boolean });
    });
  }

  const rawMood = body.mood ?? null;
  if (rawMood !== null && !MOODS.includes(rawMood as Mood)) {
    errors.push(`${field('mood')} must be one of ${MOODS.join(', ')} or null`);
  }

  const rawJournal = body.journal ?? '';
  if (typeof rawJournal !== 'string') {
    errors.push(`${field('journal')} must be a string`);
  } else if (rawJournal.length > LIMITS.journal) {
    errors.push(`${field('journal')} must be at most ${LIMITS.journal} characters`);
  }

  const habits: Habits = {};
  const rawHabits = body.habits ?? {};
  if (!isPlainObject(rawHabits)) {
    errors.push(`${field('habits')} must be an object`);
  } else if (Object.keys(rawHabits).length > LIMITS.habits) {
    errors.push(`${field('habits')} must contain at most ${LIMITS.habits} habits`);
  } else {
    for (const [key, value] of Object.entries(rawHabits)) {
      if (!HABIT_KEY_RE.test(key)) {
        errors.push(`${field('habits')} key "${key}" must be alphanumeric and start with a letter`);
      } else if (typeof value !== 'boolean') {
        errors.push(`${field(`habits.${key}`)} must be a boolean`);
      } else {
        habits[key] = value;
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { tasks, mood: rawMood as Mood | null, journal: rawJournal as string, habits },
  };
}

/**
 * Validates a whole backup before anything is written.
 * Accepts the export format ({ entries: [...] }) or a bare array of entries.
 */
export function validateImport(body: unknown): ValidationResult<ImportEntry[]> {
  const rawEntries = Array.isArray(body) ? body : isPlainObject(body) ? body.entries : undefined;
  if (!Array.isArray(rawEntries)) {
    return { ok: false, errors: ['Backup must be an array of entries or an object with an "entries" array'] };
  }
  if (rawEntries.length === 0) {
    return { ok: false, errors: ['Backup contains no entries'] };
  }
  if (rawEntries.length > LIMITS.importEntries) {
    return { ok: false, errors: [`Backup may contain at most ${LIMITS.importEntries} entries`] };
  }

  const errors: string[] = [];
  const entries: ImportEntry[] = [];
  const seenDates = new Set<string>();

  rawEntries.forEach((raw: unknown, index: number) => {
    const path = `entries[${index}]`;
    const date = isPlainObject(raw) ? raw.date : undefined;
    if (!isValidDate(date)) {
      errors.push(`${path}.date must be a valid date in YYYY-MM-DD format`);
    } else if (seenDates.has(date)) {
      errors.push(`${path}.date ${date} appears more than once`);
    } else {
      seenDates.add(date);
    }
    const result = validateEntryInput(raw, path, IMPORT_ENTRY_KEYS);
    if (!result.ok) errors.push(...result.errors);
    else if (isValidDate(date)) entries.push({ date, ...result.value });
  });

  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 50) };
  return { ok: true, value: entries };
}
