import type { Backup, DailyEntry, EntryData } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError('Unable to reach the server. Check that the backend is running.', 0);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(body?.error ?? `Request failed with status ${response.status}`, response.status, body?.details);
  }
  return body as T;
}

export const api = {
  getEntry: (date: string) => request<DailyEntry>(`/entries/${date}`),

  saveEntry: (date: string, data: EntryData) =>
    request<DailyEntry>(`/entries/${date}`, { method: 'PUT', body: JSON.stringify(data) }),

  getMonth: async (month: string) =>
    (await request<{ entries: DailyEntry[] }>(`/entries?month=${month}`)).entries,

  exportAll: () => request<Backup>('/export'),

  importBackup: (entries: DailyEntry[]) =>
    request<{ imported: number; message: string }>('/import', {
      method: 'POST',
      body: JSON.stringify({ entries }),
    }),
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.details.length > 0 ? `${err.message}: ${err.details.slice(0, 3).join('; ')}` : err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}
