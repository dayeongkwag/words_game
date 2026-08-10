import { Button } from '@/components/common/Button';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import type { ResolvedTheme } from '@/storage';

interface SharedPromptScreenProps {
  loading: boolean;
  theme: ResolvedTheme;
  onToggleTheme: () => void;
  onPlayShared: () => void;
  onPlayNew: () => void;
}

/** 공유 링크로 들어온 사용자에게 보여 주는 선택 화면. (요구사항 38) */
export function SharedPromptScreen({
  loading,
  theme,
  onToggleTheme,
  onPlayShared,
  onPlayNew,
}: SharedPromptScreenProps) {
  return (
    <div className="start">
      <div className="start__theme">
        <ThemeToggle resolved={theme} onToggle={onToggleTheme} />
      </div>

      <header className="start__hero">
        <p className="start__eyebrow">공유된 퍼즐</p>
        <h1 className="start__title">낱말퍼즐</h1>
        <p className="start__subtitle">친구가 풀었던 낱말퍼즐입니다.</p>
      </header>

      <div className="start__actions">
        <Button variant="primary" size="lg" block onClick={onPlayShared} disabled={loading}>
          {loading ? '퍼즐 불러오는 중…' : '이 퍼즐 풀어보기'}
        </Button>
        <Button variant="secondary" size="lg" block onClick={onPlayNew} disabled={loading}>
          새 퍼즐 풀기
        </Button>
      </div>
    </div>
  );
}
