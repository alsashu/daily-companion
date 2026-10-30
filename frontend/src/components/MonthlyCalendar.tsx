import { MOOD_OPTIONS } from '../config/planner';
import type { DailyEntry } from '../types';
import { buildCalendarCells, formatLongDate, formatMonthTitle, parseISODate } from '../utils/date';
import { hasData } from '../utils/entry';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface MonthlyCalendarProps {
  month: string;
  selectedDate: string;
  today: string;
  entries: DailyEntry[];
  /** Shows a list of the month's saved days below the grid (Monthly View tab). */
  showSummary?: boolean;
  onSelectDate: (date: string) => void;
  onChangeMonth: (delta: number) => void;
  onGoToToday: () => void;
}

export default function MonthlyCalendar({
  month,
  selectedDate,
  today,
  entries,
  showSummary = false,
  onSelectDate,
  onChangeMonth,
  onGoToToday,
}: MonthlyCalendarProps) {
  const withData = entries.filter(hasData);
  const datesWithData = new Set(withData.map((e) => e.date));
  const title = formatMonthTitle(month);

  return (
    <section className={`card calendar${showSummary ? ' calendar-large' : ''}`} aria-labelledby="calendar-heading">
      <div className="calendar-header">
        <button type="button" className="icon-button" onClick={() => onChangeMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <h2 id="calendar-heading" aria-live="polite">
          {title}
        </h2>
        <button type="button" className="icon-button" onClick={() => onChangeMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="calendar-grid" role="grid" aria-label={title}>
        <div className="calendar-row" role="row">
          {WEEKDAYS.map((day) => (
            <span key={day} className="calendar-weekday" role="columnheader" aria-label={day}>
              {day.slice(0, 2)}
            </span>
          ))}
        </div>
        {chunk(buildCalendarCells(month), 7).map((week, i) => (
          <div className="calendar-row" role="row" key={i}>
            {week.map((date, j) =>
              date === null ? (
                <span key={`blank-${j}`} className="calendar-day calendar-blank" role="gridcell" />
              ) : (
                <span key={date} role="gridcell">
                  <button
                    type="button"
                    className={[
                      'calendar-day',
                      date === selectedDate && 'calendar-selected',
                      date === today && 'calendar-today',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-pressed={date === selectedDate}
                    aria-current={date === today ? 'date' : undefined}
                    aria-label={`${formatLongDate(date)}${datesWithData.has(date) ? ', has entries' : ''}`}
                    onClick={() => onSelectDate(date)}
                  >
                    {parseISODate(date).getDate()}
                    {datesWithData.has(date) && <span className="calendar-dot" aria-hidden="true" />}
                  </button>
                </span>
              ),
            )}
          </div>
        ))}
      </div>

      <button type="button" className="button button-ghost calendar-today-button" onClick={onGoToToday}>
        Go to today
      </button>

      {showSummary && (
        <div className="month-summary">
          <h3>Saved days this month</h3>
          {withData.length === 0 ? (
            <p className="empty-state">Nothing saved in {title} yet.</p>
          ) : (
            <ul>
              {withData.map((entry) => {
                const done = entry.tasks.filter((t) => t.completed).length;
                const emoji = MOOD_OPTIONS.find((m) => m.mood === entry.mood)?.emoji;
                return (
                  <li key={entry.date}>
                    <button type="button" className="summary-row" onClick={() => onSelectDate(entry.date)}>
                      <span className="summary-date">{formatLongDate(entry.date)}</span>
                      <span className="summary-meta">
                        {entry.tasks.length > 0 && `${done}/${entry.tasks.length} tasks`}
                        {entry.mood && ` · ${emoji ?? ''} ${entry.mood}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
