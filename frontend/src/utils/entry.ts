import type { DailyEntry, EntryData } from '../types';

export function emptyEntry(date: string): DailyEntry {
  return { date, tasks: [], mood: null, journal: '', habits: {}, createdAt: null, updatedAt: null };
}

export function toEntryData({ tasks, mood, journal, habits }: DailyEntry): EntryData {
  return { tasks, mood, journal, habits };
}

/** Whether a day has anything worth marking on the calendar. */
export function hasData(entry: EntryData): boolean {
  return (
    entry.tasks.length > 0 ||
    entry.mood !== null ||
    entry.journal.trim() !== '' ||
    Object.values(entry.habits).some(Boolean)
  );
}

export function newTaskId(): string {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
