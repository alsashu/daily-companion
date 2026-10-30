export const MOODS = ['Excellent', 'Good', 'Average', 'Poor', 'Bad'] as const;
export type Mood = (typeof MOODS)[number];

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export type Habits = Record<string, boolean>;

/** The editable part of a day, as sent to PUT /api/entries/:date. */
export interface EntryData {
  tasks: Task[];
  mood: Mood | null;
  journal: string;
  habits: Habits;
}

export interface DailyEntry extends EntryData {
  date: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Backup {
  app: string;
  version: number;
  exportedAt: string;
  entries: DailyEntry[];
}

export type Tab = 'planner' | 'habits' | 'monthly';
export type Theme = 'light' | 'dark';

export interface Notice {
  type: 'success' | 'error' | 'info';
  text: string;
}
