import type { ResolvedTheme } from '@/storage';

interface ThemeToggleProps {
  resolved: ResolvedTheme;
  onToggle: () => void;
}

/** 라이트/다크 전환 버튼. (요구사항 41) */
export function ThemeToggle({ resolved, onToggle }: ThemeToggleProps) {
  const next = resolved === 'dark' ? '라이트' : '다크';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`${next} 모드로 전환`}
      title={`${next} 모드로 전환`}
    >
      <span aria-hidden="true">{resolved === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}
