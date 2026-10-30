import type { Task } from '../types';

interface TaskItemProps {
  task: Task;
  disabled: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function TaskItem({ task, disabled, onToggle, onDelete }: TaskItemProps) {
  const inputId = `task-${task.id}`;
  return (
    <li className={`task-item${task.completed ? ' task-completed' : ''}`}>
      <input
        id={inputId}
        type="checkbox"
        checked={task.completed}
        disabled={disabled}
        onChange={() => onToggle(task.id)}
      />
      <label htmlFor={inputId} className="task-text">
        {task.text}
      </label>
      <button
        type="button"
        className="icon-button task-delete"
        disabled={disabled}
        onClick={() => onDelete(task.id)}
        aria-label={`Delete task: ${task.text}`}
        title="Delete task"
      >
        <span aria-hidden="true">🗑</span>
      </button>
    </li>
  );
}
