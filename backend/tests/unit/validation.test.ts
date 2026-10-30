import { describe, expect, it } from 'vitest';
import { isValidDate, isValidMonth, validateEntryInput, validateImport } from '../../src/validation/entry';

describe('isValidDate', () => {
  it('accepts real calendar dates', () => {
    expect(isValidDate('2026-10-29')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true);
  });

  it('rejects malformed or impossible dates', () => {
    for (const value of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-1-01', '29-10-2026', 'today', '', 20261029, null]) {
      expect(isValidDate(value)).toBe(false);
    }
  });
});

describe('isValidMonth', () => {
  it('validates YYYY-MM', () => {
    expect(isValidMonth('2026-10')).toBe(true);
    expect(isValidMonth('2026-00')).toBe(false);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-1')).toBe(false);
    expect(isValidMonth(undefined)).toBe(false);
  });
});

describe('validateEntryInput', () => {
  const valid = {
    tasks: [{ id: 'task-1', text: '  Visit the park ', completed: false }],
    mood: 'Good',
    journal: 'Nice day',
    habits: { morningMeditation: true, exercise: false },
  };

  it('accepts and normalizes a valid entry', () => {
    const result = validateEntryInput(valid);
    expect(result).toEqual({
      ok: true,
      value: { ...valid, tasks: [{ id: 'task-1', text: 'Visit the park', completed: false }] },
    });
  });

  it('fills defaults for omitted fields', () => {
    expect(validateEntryInput({})).toEqual({
      ok: true,
      value: { tasks: [], mood: null, journal: '', habits: {} },
    });
  });

  it.each([
    ['non-object body', []],
    ['unknown field', { ...valid, extra: 1 }],
    ['tasks not an array', { tasks: {} }],
    ['task without text', { tasks: [{ id: 'a', text: ' ', completed: false }] }],
    ['task with non-boolean completed', { tasks: [{ id: 'a', text: 'x', completed: 'yes' }] }],
    ['duplicate task ids', { tasks: [{ id: 'a', text: 'x', completed: false }, { id: 'a', text: 'y', completed: false }] }],
    ['unknown mood', { mood: 'Ecstatic' }],
    ['non-string journal', { journal: 42 }],
    ['habits as array', { habits: [] }],
    ['non-boolean habit', { habits: { exercise: 'done' } }],
  ])('rejects %s', (_label, body) => {
    expect(validateEntryInput(body).ok).toBe(false);
  });
});

describe('validateImport', () => {
  const entry = { date: '2026-10-01', tasks: [], mood: null, journal: '', habits: {}, createdAt: 'x', updatedAt: 'x' };

  it('accepts the export format and a bare array', () => {
    expect(validateImport({ entries: [entry] }).ok).toBe(true);
    expect(validateImport([entry]).ok).toBe(true);
  });

  it('rejects empty, malformed and duplicate-date backups', () => {
    expect(validateImport({ entries: [] }).ok).toBe(false);
    expect(validateImport({ data: [] }).ok).toBe(false);
    expect(validateImport([{ ...entry, date: '2026-02-31' }]).ok).toBe(false);
    expect(validateImport([entry, entry]).ok).toBe(false);
  });
});
