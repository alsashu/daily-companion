import type { Mood } from '../types';

/** Default habits. Completion is stored per date in the entry's `habits` JSONB column. */
export const HABITS = [
  { key: 'morningMeditation', label: 'Morning Meditation', icon: '🧘' },
  { key: 'exercise', label: 'Exercise', icon: '🏃' },
  { key: 'read20Pages', label: 'Read 20 Pages', icon: '📖' },
] as const;

export const MOOD_OPTIONS: { mood: Mood; emoji: string }[] = [
  { mood: 'Excellent', emoji: '😄' },
  { mood: 'Good', emoji: '🙂' },
  { mood: 'Average', emoji: '😐' },
  { mood: 'Poor', emoji: '🙁' },
  { mood: 'Bad', emoji: '😞' },
];
