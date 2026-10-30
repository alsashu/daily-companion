import { useCallback, useEffect, useRef, useState } from 'react';
import DailyPlanner from './components/DailyPlanner';
import Footer from './components/Footer';
import GratitudeJournal from './components/GratitudeJournal';
import HabitTracker from './components/HabitTracker';
import Header from './components/Header';
import ImportExport from './components/ImportExport';
import MonthlyCalendar from './components/MonthlyCalendar';
import NavigationTabs from './components/NavigationTabs';
import { api, errorMessage } from './services/api';
import type { DailyEntry, EntryData, Mood, Notice, Tab, Theme } from './types';
import { monthOf, shiftMonth, todayISO } from './utils/date';
import { emptyEntry, newTaskId, toEntryData } from './utils/entry';

const THEME_KEY = 'daily-companion-theme';

// The theme is a per-browser preference, so localStorage is the right place for it.
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage unavailable (private mode, blocked cookies)
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const today = todayISO();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [tab, setTab] = useState<Tab>('planner');
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMonth, setViewMonth] = useState(monthOf(today));
  const [entry, setEntry] = useState<DailyEntry>(() => emptyEntry(today));
  const [monthEntries, setMonthEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Refs guard against double submissions and against stale responses after the date changes.
  const savingRef = useRef(false);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const viewMonthRef = useRef(viewMonth);
  viewMonthRef.current = viewMonth;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    if (notice?.type !== 'success') return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getEntry(selectedDate)
      .then((loaded) => !cancelled && setEntry(loaded))
      .catch((err) => {
        if (cancelled) return;
        setEntry(emptyEntry(selectedDate));
        setNotice({ type: 'error', text: `Could not load ${selectedDate}: ${errorMessage(err)}` });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedDate, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    api
      .getMonth(viewMonth)
      .then((entries) => !cancelled && setMonthEntries(entries))
      .catch((err) => {
        if (cancelled) return;
        setMonthEntries([]);
        setNotice({ type: 'error', text: `Could not load calendar: ${errorMessage(err)}` });
      });
    return () => {
      cancelled = true;
    };
  }, [viewMonth, reloadKey]);

  const save = useCallback(
    async (data: EntryData, successText?: string): Promise<boolean> => {
      if (savingRef.current) return false;
      savingRef.current = true;
      setSaving(true);
      try {
        const saved = await api.saveEntry(entry.date, data);
        if (saved.date === selectedDateRef.current) setEntry(saved);
        // Keep calendar indicators in sync without refetching the month.
        if (monthOf(saved.date) === viewMonthRef.current) {
          setMonthEntries((prev) =>
            [...prev.filter((e) => e.date !== saved.date), saved].sort((a, b) => a.date.localeCompare(b.date)),
          );
        }
        if (successText) setNotice({ type: 'success', text: successText });
        return true;
      } catch (err) {
        setNotice({ type: 'error', text: `Could not save: ${errorMessage(err)}` });
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [entry.date],
  );

  const data = toEntryData(entry);

  const addTask = (text: string) => save({ ...data, tasks: [...data.tasks, { id: newTaskId(), text, completed: false }] });
  const toggleTask = (id: string) =>
    save({ ...data, tasks: data.tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)) });
  const deleteTask = (id: string) => save({ ...data, tasks: data.tasks.filter((t) => t.id !== id) });
  const saveJournal = (mood: Mood | null, journal: string) => save({ ...data, mood, journal }, 'Journal entry saved.');
  const toggleHabit = (key: string) => save({ ...data, habits: { ...data.habits, [key]: !data.habits[key] } });

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setViewMonth(monthOf(date));
  };

  const calendar = (
    <MonthlyCalendar
      month={viewMonth}
      selectedDate={selectedDate}
      today={today}
      entries={monthEntries}
      showSummary={tab === 'monthly'}
      onSelectDate={selectDate}
      onChangeMonth={(delta) => setViewMonth((m) => shiftMonth(m, delta))}
      onGoToToday={() => selectDate(today)}
    />
  );

  const habitTracker = (
    <HabitTracker
      date={selectedDate}
      habits={entry.habits}
      loading={loading}
      saving={saving}
      onToggle={toggleHabit}
      monthEntries={tab === 'habits' ? monthEntries : undefined}
    />
  );

  return (
    <div className="app">
      <Header theme={theme} onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} />
      <NavigationTabs active={tab} onChange={setTab} />

      {notice && (
        <div
          className={`notice notice-${notice.type}`}
          role={notice.type === 'error' ? 'alert' : 'status'}
        >
          <span>{notice.text}</span>
          <button type="button" className="icon-button" onClick={() => setNotice(null)} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}

      <main id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className={`layout layout-${tab}`}>
        {tab === 'planner' && (
          <>
            <div className="column">
              <DailyPlanner
                date={selectedDate}
                isToday={selectedDate === today}
                tasks={entry.tasks}
                loading={loading}
                saving={saving}
                onAddTask={addTask}
                onToggleTask={toggleTask}
                onDeleteTask={deleteTask}
              />
              <GratitudeJournal
                date={selectedDate}
                mood={entry.mood}
                journal={entry.journal}
                loading={loading}
                saving={saving}
                onSave={saveJournal}
              />
            </div>
            <aside className="column">
              {calendar}
              {habitTracker}
            </aside>
          </>
        )}
        {tab === 'habits' && (
          <>
            <div className="column">{habitTracker}</div>
            <aside className="column">{calendar}</aside>
          </>
        )}
        {tab === 'monthly' && <div className="column">{calendar}</div>}
      </main>

      <ImportExport notify={setNotice} onImported={() => setReloadKey((k) => k + 1)} />
      <Footer />
    </div>
  );
}
