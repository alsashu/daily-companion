import { useState, type FormEvent } from 'react';
import type { Task } from '../types';
import { formatLongDate } from '../utils/date';
import TaskList from './TaskList';

interface DailyPlannerProps {
  date: string;
  isToday: boolean;
  tasks: Task[];
  loading: boolean;
  saving: boolean;
  onAddTask: (text: string) => Promise<boolean>;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

export default function DailyPlanner({
  date,
  isToday,
  tasks,
  loading,
  saving,
  onAddTask,
  onToggleTask,
  onDeleteTask,
}: DailyPlannerProps) {
  const [text, setText] = useState('');
  const disabled = loading || saving;
  const done = tasks.filter((t) => t.completed).length;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    if (await onAddTask(trimmed)) setText('');
  };

  return (
    <section className="card" aria-labelledby="tasks-heading">
      <div className="card-header">
        <h2 id="tasks-heading">{isToday ? "Today's Tasks" : 'Tasks'}</h2>
        {tasks.length > 0 && (
          <span className="pill" aria-label={`${done} of ${tasks.length} tasks completed`}>
            {done}/{tasks.length}
          </span>
        )}
      </div>
      <p className="card-date">{formatLongDate(date)}</p>

      <form className="task-form" onSubmit={handleSubmit}>
        <label htmlFor="new-task" className="visually-hidden">
          New task
        </label>
        <input
          id="new-task"
          type="text"
          placeholder="What would you like to do?"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="button button-primary" disabled={disabled || !text.trim()}>
          Add Task
        </button>
      </form>

      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : (
        <TaskList tasks={tasks} disabled={disabled} onToggle={onToggleTask} onDelete={onDeleteTask} />
      )}
    </section>
  );
}
