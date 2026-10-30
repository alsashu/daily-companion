// Dates are handled as local-time YYYY-MM-DD strings to match the DATE column exactly.

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** "2026-10-29" -> "2026-10" */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatMonthTitle(month: string): string {
  return parseISODate(`${month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Calendar grid for a month, weeks starting on Sunday.
 * Returns ISO dates, with null for the blank cells before the 1st and after the last day.
 */
export function buildCalendarCells(month: string): (string | null)[] {
  const [year, m] = month.split('-').map(Number);
  const leadingBlanks = new Date(year, m - 1, 1).getDay();
  const daysInMonth = new Date(year, m, 0).getDate();
  const cells: (string | null)[] = Array(leadingBlanks).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(`${month}-${pad(day)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
