import { getGameConfig } from '@/config';
import { formatDuration, formatScore } from '@/utils/format';

interface StatusBarProps {
  score: number;
  elapsedMs: number;
  mistakes: number;
  hintsUsed: number;
  progress: number;
}

/**
 * 플레이 중 정보 표시. (요구사항 16·31)
 * 한 화면에 너무 많은 정보를 늘어놓지 않도록 4개 지표로만 제한한다.
 */
export function StatusBar({ score, elapsedMs, mistakes, hintsUsed, progress }: StatusBarProps) {
  const config = getGameConfig();

  return (
    <div className="status-bar">
      <div className="status-bar__mistakes">
        <span className="status-bar__label">오답</span>
        <span className="status-bar__dots" aria-hidden="true">
          {Array.from({ length: config.mistakes.max }, (_, i) => (
            <span key={i} className={`dot ${i < mistakes ? 'dot--filled' : ''}`} />
          ))}
        </span>
        <span className="sr-only">
          {mistakes} / {config.mistakes.max}회
        </span>
      </div>

      <div className="status-bar__stats">
        <div className="status-bar__stat">
          <span className="status-bar__label">점수</span>
          <strong className="status-bar__value">{formatScore(score)}</strong>
        </div>
        <div className="status-bar__stat">
          <span className="status-bar__label">시간</span>
          <strong className="status-bar__value status-bar__value--time">
            {formatDuration(elapsedMs)}
          </strong>
        </div>
        <div className="status-bar__stat">
          <span className="status-bar__label">힌트</span>
          <strong className="status-bar__value">
            {hintsUsed}/{config.hints.max}
          </strong>
        </div>
      </div>

      <div
        className="status-bar__progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="퍼즐 진행률"
      >
        <div className="status-bar__progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
