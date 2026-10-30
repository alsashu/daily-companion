import type { DailyEntry, EntryRepository } from '../../src/services/entriesService';

/** In-memory repository with the same upsert and all-or-nothing import semantics as PostgreSQL. */
export function createFakeRepository(options: { failImportAt?: number } = {}) {
  const store = new Map<string, DailyEntry>();

  const upsertInto = (target: Map<string, DailyEntry>, date: string, input: Omit<DailyEntry, 'date' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const existing = target.get(date);
    const entry: DailyEntry = {
      date,
      tasks: input.tasks,
      mood: input.mood,
      journal: input.journal,
      habits: input.habits,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    target.set(date, entry);
    return entry;
  };

  const repo: EntryRepository = {
    async getByDate(date) {
      return store.get(date) ?? null;
    },
    async upsert(date, input) {
      return upsertInto(store, date, input);
    },
    async listByMonth(month) {
      return [...store.values()].filter((e) => e.date.startsWith(`${month}-`)).sort((a, b) => a.date.localeCompare(b.date));
    },
    async listAll() {
      return [...store.values()].sort((a, b) => a.date.localeCompare(b.date));
    },
    async importEntries(entries) {
      const draft = new Map(store);
      entries.forEach((entry, index) => {
        if (index === options.failImportAt) throw new Error('simulated database failure');
        upsertInto(draft, entry.date, entry);
      });
      store.clear();
      draft.forEach((value, key) => store.set(key, value));
      return entries.length;
    },
    async ping() {},
  };

  return { repo, store };
}
