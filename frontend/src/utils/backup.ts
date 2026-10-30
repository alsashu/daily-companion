import { HABITS } from '../config/planner';
import { MOODS, type Backup, type DailyEntry } from '../types';
import { formatLongDate } from './date';

type BackupCheck = { ok: true; entries: DailyEntry[] } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Client-side check of a backup file before it is sent to the server.
 * The server validates again; this gives fast, friendly feedback and avoids a pointless request.
 */
export function validateBackup(data: unknown): BackupCheck {
  const entries = Array.isArray(data) ? data : isObject(data) ? data.entries : undefined;
  if (!Array.isArray(entries)) return { ok: false, error: 'File is not a Daily Companion backup (missing "entries").' };
  if (entries.length === 0) return { ok: false, error: 'Backup contains no entries.' };

  const seen = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const where = `Entry ${i + 1}`;
    if (!isObject(e)) return { ok: false, error: `${where} is not an object.` };
    if (!isValidDate(e.date)) return { ok: false, error: `${where} has an invalid date.` };
    if (seen.has(e.date)) return { ok: false, error: `${where}: date ${e.date} appears twice.` };
    seen.add(e.date);
    const tasks = e.tasks ?? [];
    if (
      !Array.isArray(tasks) ||
      !tasks.every(
        (t) => isObject(t) && typeof t.id === 'string' && typeof t.text === 'string' && t.text.trim() !== '' && typeof t.completed === 'boolean',
      )
    ) {
      return { ok: false, error: `${where} (${e.date}) has invalid tasks.` };
    }
    if (e.mood != null && !MOODS.includes(e.mood as never)) return { ok: false, error: `${where} (${e.date}) has an invalid mood.` };
    if (e.journal != null && typeof e.journal !== 'string') return { ok: false, error: `${where} (${e.date}) has an invalid journal.` };
    const habits = e.habits ?? {};
    if (!isObject(habits) || !Object.values(habits).every((v) => typeof v === 'boolean')) {
      return { ok: false, error: `${where} (${e.date}) has invalid habits.` };
    }
  }
  return { ok: true, entries: entries as DailyEntry[] };
}

export function formatBackupAsText(backup: Backup): string {
  const divider = '-'.repeat(40);
  const lines = ['Daily Aesthetic Planner - Export', `Exported: ${backup.exportedAt}`, `Entries: ${backup.entries.length}`, '='.repeat(40)];

  for (const entry of backup.entries) {
    lines.push('', formatLongDate(entry.date), `Mood: ${entry.mood ?? '-'}`, 'Tasks:');
    if (entry.tasks.length === 0) lines.push('  (none)');
    for (const task of entry.tasks) lines.push(`  [${task.completed ? 'x' : ' '}] ${task.text}`);
    const habits = HABITS.map(({ key, label }) => `${label}: ${entry.habits[key] ? 'done' : 'not done'}`);
    lines.push(`Habits: ${habits.join(', ')}`, 'Journal:');
    lines.push(...(entry.journal.trim() ? entry.journal.split('\n').map((l) => `  ${l}`) : ['  (empty)']));
    lines.push(divider);
  }
  return lines.join('\n') + '\n';
}

export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
