import { useCallback, useState } from 'react';
import { Button } from '@/components/common/Button';
import { getShareConfig } from '@/config';
import { buildShareUrl, shareText } from '@/game/puzzleShare';
import type { ResolvedTheme } from '@/storage';
import type { GameResult, GameState, Puzzle, PuzzleView } from '@/types';
import { saveResultImage } from '@/utils/resultImage';

interface ShareActionsProps {
  puzzle: Puzzle;
  view: PuzzleView;
  state: GameState;
  result: GameResult;
  theme: ResolvedTheme;
}

/** 결과 공유 / 이미지 저장. (요구사항 35·39) */
export function ShareActions({ puzzle, view, state, result, theme }: ShareActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleShare = useCallback(async () => {
    setBusy(true);
    try {
      const config = getShareConfig();
      const outcome = await shareText(config.buildMessage(result), buildShareUrl(puzzle));
      setMessage(
        outcome === 'shared'
          ? '공유했습니다.'
          : outcome === 'copied'
            ? '결과와 퍼즐 링크를 복사했습니다.'
            : '공유하지 못했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }, [puzzle, result]);

  const handleSaveImage = useCallback(async () => {
    setBusy(true);
    try {
      const solvedCells = collectSolvedCells(view, state);
      const outcome = await saveResultImage({ result, view, solvedCells, theme });
      setMessage(
        outcome === 'failed'
          ? '이미지를 만들지 못했습니다.'
          : outcome === 'opened'
            ? '새 탭에서 이미지를 길게 눌러 저장하세요.'
            : '이미지를 저장했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }, [result, view, state, theme]);

  return (
    <div className="share">
      <div className="share__buttons">
        <Button variant="secondary" onClick={handleShare} disabled={busy}>
          공유하기
        </Button>
        <Button variant="ghost" onClick={handleSaveImage} disabled={busy}>
          이미지로 저장
        </Button>
      </div>
      {message && (
        <p className="share__message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

/** 결과 이미지에서 색을 채울 칸(맞힌 단어의 칸). */
function collectSolvedCells(view: PuzzleView, state: GameState): Set<string> {
  const cells = new Set<string>();
  state.wordProgress.forEach((progress, index) => {
    if (!progress.solved) return;
    const clue = view.clues[index];
    if (!clue) return;
    const dRow = clue.direction === 'down' ? 1 : 0;
    const dCol = clue.direction === 'across' ? 1 : 0;
    for (let i = 0; i < clue.length; i++) {
      cells.add(`${clue.startRow + dRow * i},${clue.startCol + dCol * i}`);
    }
  });
  return cells;
}
