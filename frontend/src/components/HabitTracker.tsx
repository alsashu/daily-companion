import { HABITS } from '../config/planner';
import type { DailyEntry, Habits } from '../types';
import { formatLongDate } from '../utils/date';

interface HabitTrackerProps {
  date: string;
  habits: Habits;
  loading: boolean;
  saving: boolean;
  onToggle: (key: string) => void;
  /** When given, shows how many days this month each habit was completed (Habit Tracker tab). */
  monthEntries?: DailyEntry[];
}

export default function HabitTracker({ date, habits, loading, saving, onToggle, monthEntries }: HabitTrackerProps) {
  const disabled = loading || saving;
  const completed = HABITS.filter((h) => habits[h.key]).length;

  return (
    <section className="card" aria-labelledby="habits-heading">
      <div className="card-header">
        <h2 id="habits-heading">Habit Tracker</h2>
        <span className="pill" aria-label={`${completed} of ${HABITS.length} habits completed`}>
          {completed}/{HABITS.length}
        </span>
      </div>
      {monthEntries && <p className="card-date">{formatLongDate(date)}</p>}
      <ul className="habit-list">
        {HABITS.map(({ key, label, icon }) => {
          const id = `habit-${key}`;
          const daysThisMonth = monthEntries?.filter((e) => e.habits[key]).length;
          return (
            <li key={key} className={`habit-item${habits[key] ? ' habit-done' : ''}`}>
              <input id={id} type="checkbox" checked={Boolean(habits[key])} disabled={disabled} onChange={() => onToggle(key)} />
              <label htmlFor={id}>
                <span aria-hidden="true">{icon}</span> {label}
              </label>
              {daysThisMonth !== undefined && (
                <span className="habit-streak">{daysThisMonth} days this month</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
