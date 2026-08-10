import { Button } from '@/components/common/Button';
import { ShareActions } from '@/components/sharing/ShareActions';
import { getGameConfig } from '@/config';
import type { ResolvedTheme } from '@/storage';
import type { GameResult, GameState, Puzzle, PuzzleView } from '@/types';
import { formatDuration, formatScore } from '@/utils/format';

interface ResultScreenProps {
  result: GameResult;
  puzzle: Puzzle;
  view: PuzzleView;
  state: GameState;
  theme: ResolvedTheme;
  onReplay: () => void;
  onNewPuzzle: () => void;
  onHome: () => void;
}

/** 게임 종료 화면. (요구사항 32·54) */
export function ResultScreen({
  result,
  puzzle,
  view,
  state,
  theme,
  onReplay,
  onNewPuzzle,
  onHome,
}: ResultScreenProps) {
  const config = getGameConfig();
  const cleared = result.status === 'COMPLETED';

  return (
    <div className="result">
      <header className="result__header">
        <p className={`result__badge ${cleared ? 'result__badge--clear' : ''}`}>
          {cleared ? '퍼즐 클리어!' : '게임 종료'}
        </p>
        <h1 className="result__score">{formatScore(result.score)}</h1>
        <p className="result__score-label">점</p>
        {!cleared && (
          <p className="result__reason">
            오답 {config.mistakes.max + 1}회로 게임이 종료되었습니다.
          </p>
        )}
      </header>

      <dl className="result__stats">
        <Stat label="소요 시간" value={formatDuration(result.elapsedMs)} />
        <Stat label="오답" value={`${result.mistakes} / ${result.maxMistakes}`} />
        <Stat label="사용한 힌트" value={`${result.hintsUsed} / ${result.maxHints}`} />
        <Stat label="맞힌 단어" value={`${result.solvedWords} / ${result.totalWords}`} />
        <Stat label="퍼즐 난이도" value={result.difficulty.label} />
        <Stat label="퍼즐 번호" value={result.puzzleId} />
      </dl>

      <div className="result__actions">
        <Button variant="primary" size="lg" block onClick={onNewPuzzle}>
          새 퍼즐 풀기
        </Button>
        <Button variant="secondary" block onClick={onReplay}>
          이 퍼즐 다시 풀기
        </Button>
      </div>

      <ShareActions puzzle={puzzle} view={view} state={state} result={result} theme={theme} />

      <button type="button" className="result__home" onClick={onHome}>
        처음 화면으로
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="result__stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
