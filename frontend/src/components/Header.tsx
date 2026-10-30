import type { Theme } from '../types';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Header({ theme, onToggleTheme }: HeaderProps) {
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <header className="header">
      <h1 className="header-title">
        <span className="star" aria-hidden="true">✦</span> Daily Aesthetic Planner
      </h1>
      <button
        type="button"
        className="icon-button theme-toggle"
        onClick={onToggleTheme}
        aria-label={`Switch to ${next} theme`}
        title={`Switch to ${next} theme`}
      >
        <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
      </button>
    </header>
  );
}
