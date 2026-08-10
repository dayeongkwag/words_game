import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UI_CONFIG } from '@/config';
import { useHangulInput } from '@/hooks/useHangulInput';
import type { GameState, PuzzleView } from '@/types';
import { logDebug } from '@/utils/debugLog';

interface PuzzleGridProps {
  view: PuzzleView;
  state: GameState;
  onSelectCell: (row: number, col: number) => void;
  onChar: (char: string) => void;
  onBackspace: () => void;
  onMove: (dRow: number, dCol: number) => void;
  onToggleDirection: () => void;
  onSubmit: () => void;
}

/**
 * 퍼즐 격자. (요구사항 20·21·27·29·42·43)
 *
 * 입력 처리 구조
 *  - 실제 키 입력은 `<input>` 하나가 전부 받는다. 이 입력창은 현재 칸을 정확히 덮는다.
 *  - 위치는 CSS Grid 에 맡긴다(모든 칸이 좌표를 명시하므로 서로 밀리지 않는다).
 *    JS 로 좌표를 재서 옮기던 방식은 타이밍 문제가 생길 여지가 있어 걷어냈다.
 *  - 숨기지 않는다. 배경만 투명하고 글자 모양은 칸과 동일하다.
 *    모바일 브라우저는 보이지 않는 입력창에 가상 키보드를 열지 않는 경우가 많다.
 *  - 조합 중인 한글(ㄱ → 가 → 각)은 입력창이 그대로 그려 준다.
 *
 * 정답 데이터는 받지 않는다 (PuzzleView 에는 정답이 없다).
 */
export function PuzzleGrid({
  view,
  state,
  onSelectCell,
  onChar,
  onBackspace,
  onMove,
  onToggleDirection,
  onSubmit,
}: PuzzleGridProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // IME 로 조합 중이라 아직 확정되지 않은 글자.
  const [composing, setComposing] = useState('');

  const handleChar = useCallback(
    (char: string) => {
      logDebug(`글자 확정: ${char}`);
      onChar(char);
    },
    [onChar],
  );

  const handleComposing = useCallback((text: string) => {
    setComposing(text);
    if (text) logDebug(`조합 중: ${text}`);
  }, []);

  const { inputProps, isComposing, reset, flush } = useHangulInput(handleChar, handleComposing);

  // 오답 흔들림 / 정답 성공 애니메이션은 잠깐만 유지한다.
  const shakingWord = useTransient(
    state.shake?.token,
    state.shake?.wordIndex,
    UI_CONFIG.animation.shakeMs,
  );
  const flashingWord = useTransient(
    state.solvedFlash?.token,
    state.solvedFlash?.wordIndex,
    UI_CONFIG.animation.solveMs,
  );

  const selectedCells = useCellSet(view, state.selectedWordIndex ?? undefined);
  const wrongCells = useCellSet(view, shakingWord);
  const solvedCells = useCellSet(view, flashingWord);

  const { row: cursorRow, col: cursorCol } = state.cursor;

  const focusInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      logDebug('focus 실패: input 없음');
      return;
    }
    input.focus({ preventScroll: true });
    logDebug(`focus() 호출 → 성공=${document.activeElement === input}`);
  }, []);

  // 퍼즐이 바뀌면 입력 버퍼를 비운다.
  useEffect(() => {
    reset(inputRef.current);
  }, [view.puzzleId, reset]);

  /**
   * 다른 칸 누르기.
   * preventDefault() 를 부르지 않는다 — 모바일 브라우저는 기본 동작이 막힌 제스처에서
   * 가상 키보드를 열지 않는 경우가 있다. focus() 는 이 핸들러 안에서 동기적으로 부른다.
   */
  const handleCellPointerDown = useCallback(
    (row: number, col: number) => {
      logDebug(`칸 탭 (${row},${col})`);
      // 조합 중이던 글자를 먼저 지금 칸에 확정한 뒤 이동한다. (버려지지 않게)
      flush(inputRef.current);
      onSelectCell(row, col);
      focusInput();
    },
    [flush, onSelectCell, focusInput],
  );

  /** 포커스가 빠질 때도 조합 중이던 글자를 잃지 않도록 확정한다. */
  const handleInputBlur = useCallback(() => {
    logDebug('입력창 blur 됨');
    flush(inputRef.current);
  }, [flush]);

  /**
   * 현재 칸 누르기. 입력창이 현재 칸을 덮고 있으므로 이 핸들러가 받는다.
   * 같은 칸을 다시 누른 것이므로 가로↔세로를 전환한다. (요구사항 21)
   */
  const handleInputPointerDown = useCallback(() => {
    logDebug('입력창 탭 (현재 칸) → 방향 전환');
    if (isComposing()) return;
    onToggleDirection();
  }, [isComposing, onToggleDirection]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // 조합 중에는 IME 가 처리하도록 그대로 둔다.
      if (isComposing()) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          onMove(0, -1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          onMove(0, 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          onMove(-1, 0);
          break;
        case 'ArrowDown':
          event.preventDefault();
          onMove(1, 0);
          break;
        case 'Backspace':
          event.preventDefault();
          onBackspace();
          break;
        case 'Enter':
          event.preventDefault();
          onSubmit();
          break;
        // Tab / Space 는 가로↔세로 전환에 쓴다. (요구사항 43)
        case 'Tab':
        case ' ':
          event.preventDefault();
          onToggleDirection();
          break;
        default:
          break;
      }
    },
    [isComposing, onMove, onBackspace, onSubmit, onToggleDirection],
  );

  return (
    <div className="grid-wrap">
      <div
        id="puzzle-grid"
        className="grid"
        style={{ ['--cols' as string]: view.cols, ['--rows' as string]: view.rows }}
        role="grid"
        aria-label="낱말퍼즐 격자"
      >
        {view.blocked.map((rowCells, row) =>
          rowCells.map((blocked, col) => {
            const key = `${row},${col}`;
            // 모든 칸이 자기 좌표를 명시한다. 자동 배치에 맡기면 칸이 밀릴 수 있다.
            const position = { gridRow: row + 1, gridColumn: col + 1 };

            if (blocked) {
              return (
                <div key={key} className="cell cell--block" style={position} aria-hidden="true" />
              );
            }

            const isCursor = row === cursorRow && col === cursorCol;
            // 조합 중인 글자는 입력창이 직접 그리므로 칸은 비워 둔다. (겹침 방지)
            const value = isCursor && composing ? '' : state.userGrid[row][col];

            const classes = [
              'cell',
              // 선택한 낱말의 칸은 누른 칸까지 포함해 전부 똑같이 강조한다.
              selectedCells.has(key) ? 'cell--in-word' : '',
              state.lockedCells[row][col] ? 'cell--locked' : '',
              wrongCells.has(key) ? 'cell--wrong' : '',
              solvedCells.has(key) ? 'cell--solved' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={key}
                type="button"
                className={classes}
                style={position}
                data-row={row}
                data-col={col}
                // 칸마다 탭 순서에 들어가면 키보드 탐색이 괴로워진다.
                // 아래 입력창이 단일 탭 지점이 되어 방향키로 이동한다.
                tabIndex={-1}
                onPointerDown={() => handleCellPointerDown(row, col)}
                /*
                 * mousedown 의 기본 동작은 "클릭된 요소에 포커스를 준다" 이다.
                 * 그대로 두면 pointerdown 에서 입력창에 준 포커스를 곧바로 빼앗아
                 * 키보드는 떠 있는데 글자가 아무 데도 들어가지 않는다. (실제 겪은 버그)
                 *
                 * pointerdown 이 아니라 mousedown 에서만 막는 이유:
                 * 모바일은 pointerdown 의 기본 동작이 막히면 가상 키보드를 열지 않는다.
                 */
                onMouseDown={(event) => event.preventDefault()}
                aria-label={buildCellLabel(view, row, col, state.userGrid[row][col])}
                aria-current={isCursor ? 'true' : undefined}
              >
                {view.numbers[row][col] !== null && (
                  <span className="cell__number">{view.numbers[row][col]}</span>
                )}
                <span className="cell__letter">{value}</span>
              </button>
            );
          }),
        )}

        {/*
          현재 칸을 덮는 입력창.

          바깥 div 가 격자 아이템으로서 칸 영역을 그대로 차지하고(빈 div 는 기본으로
          영역을 가득 채운다), 입력창은 그 div 를 inset:0 으로 채운다.
          입력창을 직접 격자 아이템으로 두면 브라우저마다 크기 계산이 달라
          칸을 벗어나는 일이 있어서, 크기 책임을 div 에 맡겼다.
        */}
        <div
          className="grid__input-slot"
          style={{ gridRow: cursorRow + 1, gridColumn: cursorCol + 1 }}
        >
          <input
            ref={inputRef}
            className="grid__input"
            type="text"
            inputMode="text"
            lang="ko"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="글자 입력"
            onPointerDown={handleInputPointerDown}
            onFocus={() => logDebug('입력창 focus 됨')}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            {...inputProps}
          />
        </div>
      </div>
    </div>
  );
}

/** 토큰이 바뀌면 값을 잠시 유지했다가 자동으로 비운다. */
function useTransient<T>(token: number | undefined, value: T | undefined, durationMs: number) {
  const [current, setCurrent] = useState<T | undefined>(undefined);

  useEffect(() => {
    if (token === undefined || value === undefined) return;
    setCurrent(value);
    const id = window.setTimeout(() => setCurrent(undefined), durationMs);
    return () => window.clearTimeout(id);
  }, [token, value, durationMs]);

  return current;
}

/** 단어 인덱스 → 그 단어가 차지하는 칸들의 집합. */
function useCellSet(view: PuzzleView, wordIndex: number | undefined): Set<string> {
  return useMemo(() => {
    const set = new Set<string>();
    if (wordIndex === undefined) return set;
    const clue = view.clues[wordIndex];
    if (!clue) return set;
    const dRow = clue.direction === 'down' ? 1 : 0;
    const dCol = clue.direction === 'across' ? 1 : 0;
    for (let i = 0; i < clue.length; i++) {
      set.add(`${clue.startRow + dRow * i},${clue.startCol + dCol * i}`);
    }
    return set;
  }, [view, wordIndex]);
}

function buildCellLabel(view: PuzzleView, row: number, col: number, value: string): string {
  const words = view.cellWords[row][col];
  const parts: string[] = [];
  if (words?.across != null) parts.push(`가로 ${view.clues[words.across].number}번`);
  if (words?.down != null) parts.push(`세로 ${view.clues[words.down].number}번`);
  return `${row + 1}행 ${col + 1}열 ${parts.join(', ')} ${value ? `입력값 ${value}` : '비어 있음'}`;
}
