import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { DailyEntry, EntryData } from '../types';

// In-memory stand-in for the backend, shared by the mocked api module.
const backend = vi.hoisted(() => ({ store: new Map<string, DailyEntry>() }));

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/api')>();
  const empty = (date: string): DailyEntry => ({ date, tasks: [], mood: null, journal: '', habits: {}, createdAt: null, updatedAt: null });
  return {
    ...actual,
    api: {
      getEntry: vi.fn(async (date: string) => backend.store.get(date) ?? empty(date)),
      saveEntry: vi.fn(async (date: string, data: EntryData) => {
        const now = new Date().toISOString();
        const saved = { date, ...data, createdAt: now, updatedAt: now };
        backend.store.set(date, saved);
        return saved;
      }),
      getMonth: vi.fn(async (month: string) => [...backend.store.values()].filter((e) => e.date.startsWith(month))),
      exportAll: vi.fn(async () => ({ app: 'daily-companion', version: 1, exportedAt: '', entries: [...backend.store.values()] })),
      importBackup: vi.fn(async (entries: DailyEntry[]) => ({ imported: entries.length, message: `Imported ${entries.length} entries.` })),
    },
  };
});

const { api } = await import('../services/api');

async function renderApp() {
  const user = userEvent.setup();
  render(<App />);
  await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
  return user;
}

async function addTask(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByLabelText('New task'), text);
  await user.click(screen.getByRole('button', { name: 'Add Task' }));
  await screen.findByLabelText(text);
}

beforeEach(() => {
  backend.store.clear();
  vi.clearAllMocks();
  // Freeze "today" at 29 October 2026 without faking timers used by React and user-event.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 29, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Daily planner', () => {
  it("shows today's date and an empty task list", async () => {
    await renderApp();
    expect(screen.getByRole('heading', { name: "Today's Tasks" })).toBeInTheDocument();
    expect(screen.getByText('Thursday, October 29, 2026')).toBeInTheDocument();
    expect(screen.getByText(/No tasks yet/)).toBeInTheDocument();
  });

  it('creates a task and saves it through the API', async () => {
    const user = await renderApp();
    await addTask(user, 'Visit the park');

    expect(screen.getByLabelText('New task')).toHaveValue('');
    expect(api.saveEntry).toHaveBeenCalledWith(
      '2026-10-29',
      expect.objectContaining({ tasks: [expect.objectContaining({ text: 'Visit the park', completed: false })] }),
    );
    expect(backend.store.get('2026-10-29')?.tasks).toHaveLength(1);
  });

  it('completes a task with a strikethrough style', async () => {
    const user = await renderApp();
    await addTask(user, 'Water the plants');

    await user.click(screen.getByLabelText('Water the plants'));
    await waitFor(() => expect(screen.getByLabelText('Water the plants')).toBeChecked());
    expect(screen.getByLabelText('Water the plants').closest('li')).toHaveClass('task-completed');
    expect(backend.store.get('2026-10-29')?.tasks[0].completed).toBe(true);
  });

  it('deletes a task', async () => {
    const user = await renderApp();
    await addTask(user, 'Call mom');

    await user.click(screen.getByRole('button', { name: 'Delete task: Call mom' }));
    await waitFor(() => expect(screen.queryByLabelText('Call mom')).not.toBeInTheDocument());
    expect(backend.store.get('2026-10-29')?.tasks).toEqual([]);
  });

  it('saves a journal entry with mood and reloads it when returning to the date', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: /Good/ }));
    await user.type(screen.getByLabelText(/grateful for/), 'Sunny morning walk');
    await user.click(screen.getByRole('button', { name: 'Save Journal Entry' }));

    await screen.findByText('Journal entry saved.');
    expect(backend.store.get('2026-10-29')).toMatchObject({ mood: 'Good', journal: 'Sunny morning walk' });

    await user.click(screen.getByRole('button', { name: /October 30, 2026/ }));
    await waitFor(() => expect(screen.getByLabelText(/grateful for/)).toHaveValue(''));
    expect(screen.getByRole('button', { name: /Good/ })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: /October 29, 2026/ }));
    await waitFor(() => expect(screen.getByLabelText(/grateful for/)).toHaveValue('Sunny morning walk'));
    expect(screen.getByRole('button', { name: /Good/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves habit completion for the selected date', async () => {
    const user = await renderApp();
    await user.click(screen.getByLabelText(/Exercise/));
    await waitFor(() => expect(screen.getByLabelText(/Exercise/)).toBeChecked());
    expect(backend.store.get('2026-10-29')?.habits).toEqual({ exercise: true });
  });

  it('marks saved dates on the calendar', async () => {
    const user = await renderApp();
    expect(screen.getByRole('button', { name: 'Thursday, October 29, 2026' })).toBeInTheDocument();
    await addTask(user, 'Stretch');
    expect(screen.getByRole('button', { name: 'Thursday, October 29, 2026, has entries' })).toBeInTheDocument();
  });
});

describe('Calendar navigation', () => {
  it('moves between months and loads the selected date', async () => {
    backend.store.set('2026-11-15', {
      date: '2026-11-15',
      tasks: [{ id: 't1', text: 'November plan', completed: false }],
      mood: null,
      journal: '',
      habits: {},
      createdAt: null,
      updatedAt: null,
    });
    const user = await renderApp();
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
    expect(api.getMonth).toHaveBeenCalledWith('2026-11');

    const day = await screen.findByRole('button', { name: 'Sunday, November 15, 2026, has entries' });
    await user.click(day);
    expect(await screen.findByLabelText('November plan')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to today' }));
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: "Today's Tasks" })).toBeInTheDocument();
  });

  it('switches tabs', async () => {
    const user = await renderApp();
    await user.click(screen.getByRole('tab', { name: 'Monthly View' }));
    expect(screen.getByRole('tab', { name: 'Monthly View' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Saved days this month')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Habit Tracker' }));
    expect(within(screen.getByRole('tabpanel')).getAllByText('0 days this month')).toHaveLength(3);
  });
});

describe('Import', () => {
  function uploadFile(user: ReturnType<typeof userEvent.setup>, contents: string) {
    const file = new File([contents], 'backup.json', { type: 'application/json' });
    return user.upload(screen.getByLabelText('Choose a JSON backup file to import'), file);
  }

  it('rejects invalid JSON files without calling the API', async () => {
    const user = await renderApp();
    await uploadFile(user, '{not json');
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid JSON');
    expect(api.importBackup).not.toHaveBeenCalled();
  });

  it('rejects backups with invalid entries', async () => {
    const user = await renderApp();
    await uploadFile(user, JSON.stringify({ entries: [{ date: '2026-02-30', tasks: [] }] }));
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid date');
    expect(api.importBackup).not.toHaveBeenCalled();
  });

  it('imports a valid backup after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = await renderApp();
    const entries = [{ date: '2026-10-29', tasks: [], mood: 'Good', journal: 'Imported', habits: {} }];
    await uploadFile(user, JSON.stringify({ entries }));
    expect(await screen.findByText('Imported 1 entries.')).toBeInTheDocument();
    expect(api.importBackup).toHaveBeenCalledWith(entries);
  });
});
