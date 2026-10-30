import { MOOD_OPTIONS } from '../config/planner';
import type { Mood } from '../types';

interface MoodSelectorProps {
  value: Mood | null;
  disabled: boolean;
  onChange: (mood: Mood | null) => void;
}

export default function MoodSelector({ value, disabled, onChange }: MoodSelectorProps) {
  return (
    <fieldset className="mood-selector">
      <legend>How are you feeling?</legend>
      <div className="mood-options">
        {MOOD_OPTIONS.map(({ mood, emoji }) => (
          <button
            key={mood}
            type="button"
            className={`mood-button${value === mood ? ' mood-selected' : ''}`}
            aria-pressed={value === mood}
            disabled={disabled}
            // Clicking the selected mood again clears it.
            onClick={() => onChange(value === mood ? null : mood)}
          >
            <span className="mood-emoji" aria-hidden="true">{emoji}</span>
            <span className="mood-label">{mood}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
