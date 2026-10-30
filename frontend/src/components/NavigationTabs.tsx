import type { KeyboardEvent } from 'react';
import type { Tab } from '../types';

export const TABS: { id: Tab; label: string }[] = [
  { id: 'planner', label: 'Daily Planner' },
  { id: 'habits', label: 'Habit Tracker' },
  { id: 'monthly', label: 'Monthly View' },
];

interface NavigationTabsProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function NavigationTabs({ active, onChange }: NavigationTabsProps) {
  // Left/Right arrow keys move between tabs, following the WAI-ARIA tabs pattern.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = TABS.findIndex((t) => t.id === active);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <nav className="tabs" role="tablist" aria-label="Planner sections" onKeyDown={handleKeyDown}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          id={`tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={tab.id === active}
          aria-controls="tab-panel"
          tabIndex={tab.id === active ? 0 : -1}
          className={`tab${tab.id === active ? ' tab-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
