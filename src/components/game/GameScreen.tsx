import { useMemo, useState } from 'react';
import { Button } from '@/components/common/Button';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { ClueList } from '@/components/clue/ClueList';
import { CluePopover } from '@/components/clue/CluePopover';
import { HintPanel } from '@/components/hint/HintPanel';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { StatusBar } from '@/components/game/StatusBar';
import type { GameAction } from '@/game/gameState';
import { getProgress } from '@/game/gameState';
import type { HintAvailability } from '@/game/hintSystem';
import { splitClues } from '@/game/puzzleView';
import type { ResolvedTheme } from '@/storage';
import type { GameState, PuzzleView } from '@/types';

interface GameScreenProps {
  view: PuzzleView;
  state: GameState;
  hints: HintAvailability;
  theme: ResolvedTheme;
  notice: string | null;
  onToggleTheme: () => void;
  onExit: () => void;
  dispatch: (action: GameAction) => void;
}

/** 플레이 화면. (요구사항 16·42) */
export function GameScreen({
  view,
  state,
  hints,
  theme,
  notice,
  onToggleTheme,
  onExit,
  dispatch,
}: GameScreenProps) {
  const [hintOpen, setHintOpen] = useState(false);
  const { across, down } = useMemo(() => splitClues(view), [view]);
  const solvedFlags = useMemo(() => state.wordProgress.map((p) => p.solved), [state.wordProgress]);

  const selectedClue =
    state.selectedWordIndex !== null ? (view.clues[state.selectedWordIndex] ?? null) : null;
  const selectedSolved =
    state.selectedWordIndex !== null ? (solvedFlags[state.selectedWordIndex] ?? false) : false;

  return (
    <div className="game">
      <header className="game__header">
        <button type="button" className="game__back" onClick={onExit} aria-label="게임 나가기">
          ←
        </button>
        <div className="game__title-group">
          <h1 className="game__title">낱말퍼즐</h1>
          <span className="game__difficulty">{view.difficulty.label}</span>
        </div>
        <ThemeToggle resolved={theme} onToggle={onToggleTheme} />
      </header>

      {notice && <p className="game__notice">{notice}</p>}

      <StatusBar
        score={state.score}
        elapsedMs={state.elapsedMs}
        mistakes={state.mistakes}
        hintsUsed={state.hintsUsed.length}
        progress={getProgress(state)}
      />

      {/*
        힌트 버튼은 격자 밖 고정 위치에 둔다.
        말풍선 안에 두면 격자 위에 떠서 그 아래 칸의 탭을 가로채고,
        그러면 칸 선택과 입력 포커스가 함께 깨진다. (요구사항 16)
      */}
      <div className="game__actions">
        <button
          type="button"
          className="hint-button"
          onClick={() => setHintOpen(true)}
          disabled={!hints.canUse || selectedSolved || !selectedClue}
        >
          힌트 사용
          <span className="hint-button__count">
            {hints.remaining}/{hints.max}
          </span>
        </button>
      </div>

      <div className="game__board">
        <div className="game__clues game__clues--left">
          <ClueList
            title="가로"
            clues={across}
            selectedIndex={state.selectedWordIndex}
            solved={solvedFlags}
            onSelect={(wordIndex) => dispatch({ type: 'SELECT_WORD', wordIndex })}
          />
        </div>

        <div className="game__grid">
          <PuzzleGrid
            view={view}
            state={state}
            onSelectCell={(row, col) => dispatch({ type: 'SELECT_CELL', row, col })}
            onChar={(char) => dispatch({ type: 'INPUT_CHAR', char })}
            onBackspace={() => dispatch({ type: 'BACKSPACE' })}
            onMove={(dRow, dCol) => dispatch({ type: 'MOVE_CURSOR', dRow, dCol })}
            onToggleDirection={() => dispatch({ type: 'TOGGLE_DIRECTION' })}
            onSubmit={() => dispatch({ type: 'SUBMIT' })}
          />
        </div>

        <div className="game__clues game__clues--right">
          <ClueList
            title="세로"
            clues={down}
            selectedIndex={state.selectedWordIndex}
            solved={solvedFlags}
            onSelect={(wordIndex) => dispatch({ type: 'SELECT_WORD', wordIndex })}
          />
        </div>
      </div>

      {state.status === 'PAUSED' && (
        <div className="game__paused">
          <p>일시정지됨</p>
          <Button variant="primary" onClick={() => dispatch({ type: 'RESUME' })}>
            이어서 하기
          </Button>
        </div>
      )}

      {/* 선택한 칸에 붙는 말풍선 문제 카드. (요구사항 22) */}
      <CluePopover
        clue={selectedClue}
        solved={selectedSolved}
        anchorRow={state.cursor.row}
        anchorCol={state.cursor.col}
        initials={
          state.selectedWordIndex !== null
            ? state.revealedInitials[state.selectedWordIndex]
            : undefined
        }
      />

      <HintPanel
        open={hintOpen}
        availability={hints}
        onClose={() => setHintOpen(false)}
        onSelect={(hintType) => dispatch({ type: 'USE_HINT', hintType })}
      />
    </div>
  );
}
