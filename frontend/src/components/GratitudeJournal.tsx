import { useEffect, useState, type FormEvent } from 'react';
import type { Mood } from '../types';
import MoodSelector from './MoodSelector';

interface GratitudeJournalProps {
  date: string;
  mood: Mood | null;
  journal: string;
  loading: boolean;
  saving: boolean;
  onSave: (mood: Mood | null, journal: string) => void;
}

export default function GratitudeJournal({ date, mood, journal, loading, saving, onSave }: GratitudeJournalProps) {
  // Draft values stay local until "Save Journal Entry" is pressed.
  const [draftMood, setDraftMood] = useState<Mood | null>(mood);
  const [draftJournal, setDraftJournal] = useState(journal);

  useEffect(() => {
    setDraftMood(mood);
    setDraftJournal(journal);
  }, [date, mood, journal]);

  const dirty = draftMood !== mood || draftJournal !== journal;
  const disabled = loading || saving;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!disabled) onSave(draftMood, draftJournal);
  };

  return (
    <section className="card" aria-labelledby="journal-heading">
      <div className="card-header">
        <h2 id="journal-heading">Gratitude &amp; Mood Journal</h2>
        {dirty && <span className="pill pill-muted">Unsaved</span>}
      </div>
      <form onSubmit={handleSubmit} className="journal-form">
        <MoodSelector value={draftMood} disabled={disabled} onChange={setDraftMood} />
        <label htmlFor="journal-text" className="field-label">
          Today I'm grateful for…
        </label>
        <textarea
          id="journal-text"
          rows={6}
          maxLength={10000}
          placeholder="Write a few lines about your day."
          value={draftJournal}
          disabled={loading}
          onChange={(e) => setDraftJournal(e.target.value)}
        />
        <button type="submit" className="button button-primary" disabled={disabled || !dirty}>
          {saving ? 'Saving…' : 'Save Journal Entry'}
        </button>
      </form>
    </section>
  );
}
