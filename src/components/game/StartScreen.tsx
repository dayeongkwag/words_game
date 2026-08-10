import { Button } from '@/components/common/Button';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { RecordList } from '@/components/result/RecordList';
import type { ResolvedTheme } from '@/storage';
import type { PlayRecord } from '@/types';

interface StartScreenProps {
  records: PlayRecord[];
  loading: boolean;
  theme: ResolvedTheme;
  onToggleTheme: () => void;
  onStart: () => void;
}

/** 시작 화면. (요구사항 40) 회원가입 없이 바로 시작할 수 있다. */
export function StartScreen({ records, loading, theme, onToggleTheme, onStart }: StartScreenProps) {
  return (
    <div className="start">
      <div className="start__theme">
        <ThemeToggle resolved={theme} onToggle={onToggleTheme} />
      </div>

      <header className="start__hero">
        <p className="start__eyebrow">매번 새로 만들어지는</p>
        <h1 className="start__title">낱말퍼즐</h1>
        <p className="start__subtitle">
          가로세로로 얽힌 한국어 단어를 채워 보세요.
          <br />
          퍼즐은 시작할 때마다 새로 만들어집니다.
        </p>
      </header>

      <Button variant="primary" size="lg" block onClick={onStart} disabled={loading}>
        {loading ? '퍼즐 만드는 중…' : '새 퍼즐 풀기'}
      </Button>

      <RecordList records={records} />
    </div>
  );
}
