import { describe, expect, it } from 'vitest';
import type { Backup } from '../types';
import { formatBackupAsText, validateBackup } from '../utils/backup';
import { buildCalendarCells, shiftMonth } from '../utils/date';
import { hasData } from '../utils/entry';

describe('buildCalendarCells', () => {
  it('aligns October 2026 so the 1st falls on Thursday', () => {
    const cells = buildCalendarCells('2026-10');
    expect(cells.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
    expect(cells.filter(Boolean)).toHaveLength(31);
    expect(cells.length % 7).toBe(0);
  });

  it('handles February in leap and non-leap years', () => {
    expect(buildCalendarCells('2024-02').filter(Boolean)).toHaveLength(29);
    expect(buildCalendarCells('2026-02').filter(Boolean)).toHaveLength(28);
  });

  it('starts a month beginning on Sunday without blanks', () => {
    expect(buildCalendarCells('2026-11')[0]).toBe('2026-11-01');
  });
});

describe('shiftMonth', () => {
  it('crosses year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('hasData', () => {
  it('ignores days with only unchecked habits', () => {
    expect(hasData({ tasks: [], mood: null, journal: '  ', habits: { exercise: false } })).toBe(false);
    expect(hasData({ tasks: [], mood: 'Good', journal: '', habits: {} })).toBe(true);
  });
});

describe('validateBackup', () => {
  const entry = { date: '2026-10-29', tasks: [{ id: 'a', text: 'x', completed: true }], mood: 'Good', journal: '', habits: { exercise: true } };

  it('accepts exported backups and bare arrays', () => {
    expect(validateBackup({ entries: [entry] }).ok).toBe(true);
    expect(validateBackup([entry]).ok).toBe(true);
  });

  it.each([
    ['missing entries', {}],
    ['no entries', { entries: [] }],
    ['bad date', [{ ...entry, date: '2026-13-01' }]],
    ['duplicate dates', [entry, entry]],
    ['bad task', [{ ...entry, tasks: [{ id: 'a', text: 'x' }] }]],
    ['bad mood', [{ ...entry, mood: 'Great' }]],
    ['bad habits', [{ ...entry, habits: { exercise: 'yes' } }]],
  ])('rejects %s', (_label, data) => {
    expect(validateBackup(data).ok).toBe(false);
  });
});

describe('formatBackupAsText', () => {
  it('renders tasks, mood, habits and journal', () => {
    const backup: Backup = {
      app: 'daily-companion',
      version: 1,
      exportedAt: '2026-10-29T10:00:00.000Z',
      entries: [
        {
          date: '2026-10-29',
          tasks: [{ id: 'a', text: 'Visit the park', completed: true }],
          mood: 'Good',
          journal: 'Lovely day',
          habits: { exercise: true },
          createdAt: null,
          updatedAt: null,
        },
      ],
    };
    const text = formatBackupAsText(backup);
    expect(text).toContain('Thursday, October 29, 2026');
    expect(text).toContain('[x] Visit the park');
    expect(text).toContain('Mood: Good');
    expect(text).toContain('Exercise: done');
    expect(text).toContain('Morning Meditation: not done');
    expect(text).toContain('  Lovely day');
  });
});
