import { gameOverAtMistake, getGameConfig, type GameConfig } from '@/config';
import type {
  Cursor,
  Direction,
  GameResult,
  GameState,
  GameStatus,
  HintType,
  Puzzle,
  WordPlacement,
  WordProgress,
} from '@/types';
import { toSyllables } from '@/utils/hangul';
import { cellAt, offsetOfCursor, resolveHint } from './hintSystem';
import { computeScore } from './scoring';

/**
 * 게임 상태 머신. (요구사항 7·8·28·29·51·53)
 *
 * 순수 리듀서로 구현되어 있어 UI 없이도 전 과정을 테스트할 수 있다.
 * 정답 데이터(Puzzle)는 상태에 저장하지 않고 매 액션마다 인자로 받는다.
 * → 사용자 입력(userGrid)과 정답(puzzle.grid)이 물리적으로 분리된다.
 */

export type GameAction =
  | { type: 'SELECT_CELL'; row: number; col: number }
  | { type: 'SET_DIRECTION'; direction: Direction }
  | { type: 'TOGGLE_DIRECTION' }
  | { type: 'SELECT_WORD'; wordIndex: number }
  | { type: 'MOVE_CURSOR'; dRow: number; dCol: number }
  | { type: 'MOVE_WITHIN_WORD'; delta: number }
  | { type: 'INPUT_CHAR'; char: string }
  | { type: 'BACKSPACE' }
  | { type: 'CLEAR_CELL' }
  | { type: 'SUBMIT' }
  | { type: 'USE_HINT'; hintType: HintType }
  | { type: 'TICK'; deltaMs: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'GIVE_UP' };

/** 각 상태에서 허용되는 액션. (요구사항 51) */
const ALLOWED_ACTIONS: Record<GameStatus, ReadonlySet<GameAction['type']> | 'all'> = {
  INITIALIZING: new Set<GameAction['type']>([]),
  PLAYING: 'all',
  PAUSED: new Set<GameAction['type']>(['RESUME', 'PAUSE']),
  COMPLETED: new Set<GameAction['type']>([]),
  GAME_OVER: new Set<GameAction['type']>([]),
};

export function isActionAllowed(status: GameStatus, action: GameAction['type']): boolean {
  const allowed = ALLOWED_ACTIONS[status];
  return allowed === 'all' ? true : allowed.has(action);
}

/** 새 게임 상태를 만든다. */
export function createInitialState(puzzle: Puzzle, now = Date.now()): GameState {
  const userGrid = puzzle.grid.map((row) => row.map(() => ''));
  const lockedCells = puzzle.grid.map((row) => row.map(() => false));

  const wordProgress: WordProgress[] = puzzle.words.map(() => ({
    solved: false,
    revealedByHint: false,
    mistakes: 0,
    revealedOffsets: [],
    initialsRevealed: false,
    lastWrongSignature: null,
  }));

  // 1번 문제(가장 왼쪽 위)에서 시작한다.
  const first = puzzle.words[0];
  const cursor: Cursor = first
    ? { row: first.startRow, col: first.startCol, direction: first.direction }
    : { row: 0, col: 0, direction: 'across' };

  return {
    status: 'PLAYING',
    userGrid,
    lockedCells,
    revealedInitials: {},
    cursor,
    selectedWordIndex: first ? 0 : null,
    wordProgress,
    mistakes: 0,
    hintsUsed: [],
    score: 0,
    elapsedMs: 0,
    shake: null,
    solvedFlash: null,
    startedAt: now,
    finishedAt: null,
  };
}

export interface ReducerContext {
  puzzle: Puzzle;
  config?: GameConfig;
  /** 애니메이션 토큰 생성용. 테스트에서 결정론적으로 만들기 위해 주입 가능. */
  now?: number;
}

export function gameReducer(state: GameState, action: GameAction, ctx: ReducerContext): GameState {
  if (!isActionAllowed(state.status, action.type)) return state;

  const { puzzle } = ctx;
  const config = ctx.config ?? getGameConfig();

  switch (action.type) {
    case 'SELECT_CELL':
      return selectCell(state, puzzle, action.row, action.col);

    case 'SET_DIRECTION':
      return selectDirection(state, puzzle, action.direction);

    case 'TOGGLE_DIRECTION':
      return selectDirection(state, puzzle, state.cursor.direction === 'across' ? 'down' : 'across');

    case 'SELECT_WORD': {
      const placement = puzzle.words[action.wordIndex];
      if (!placement) return state;
      return {
        ...state,
        selectedWordIndex: action.wordIndex,
        cursor: {
          row: placement.startRow,
          col: placement.startCol,
          direction: placement.direction,
        },
      };
    }

    case 'MOVE_CURSOR':
      return moveCursor(state, puzzle, action.dRow, action.dCol);

    case 'MOVE_WITHIN_WORD':
      return moveWithinWord(state, puzzle, action.delta);

    case 'INPUT_CHAR':
      return inputChar(state, puzzle, config, action.char);

    case 'BACKSPACE':
      return backspace(state, puzzle);

    case 'CLEAR_CELL':
      return clearCell(state, puzzle);

    case 'SUBMIT':
      return submit(state, puzzle, config);

    case 'USE_HINT':
      return useHint(state, puzzle, config, action.hintType);

    case 'TICK':
      return { ...state, elapsedMs: state.elapsedMs + Math.max(0, action.deltaMs) };

    case 'PAUSE':
      return state.status === 'PLAYING' ? { ...state, status: 'PAUSED' } : state;

    case 'RESUME':
      return state.status === 'PAUSED' ? { ...state, status: 'PLAYING' } : state;

    case 'GIVE_UP':
      return finish(state, puzzle, 'GAME_OVER', ctx.now ?? Date.now());

    default: {
      const exhaustive: never = action;
      throw new Error(`알 수 없는 액션: ${JSON.stringify(exhaustive)}`);
    }
  }
}

// ── 커서 / 선택 ───────────────────────────────────────────────────────

function selectCell(state: GameState, puzzle: Puzzle, row: number, col: number): GameState {
  const cell = puzzle.cells[row]?.[col];
  if (!cell) return state;

  const isSameCell = state.cursor.row === row && state.cursor.col === col;
  const hasAcross = cell.acrossIndex !== null;
  const hasDown = cell.downIndex !== null;

  // 같은 칸을 다시 누르면 가로↔세로를 전환한다. (요구사항 21)
  let direction: Direction = state.cursor.direction;
  if (isSameCell && hasAcross && hasDown) {
    direction = direction === 'across' ? 'down' : 'across';
  } else if (direction === 'across' && !hasAcross) {
    direction = 'down';
  } else if (direction === 'down' && !hasDown) {
    direction = 'across';
  }

  const wordIndex = direction === 'across' ? cell.acrossIndex : cell.downIndex;

  return {
    ...state,
    cursor: { row, col, direction },
    selectedWordIndex: wordIndex,
  };
}

function selectDirection(state: GameState, puzzle: Puzzle, direction: Direction): GameState {
  const cell = puzzle.cells[state.cursor.row]?.[state.cursor.col];
  if (!cell) return state;
  const wordIndex = direction === 'across' ? cell.acrossIndex : cell.downIndex;
  if (wordIndex === null) return state;
  return { ...state, cursor: { ...state.cursor, direction }, selectedWordIndex: wordIndex };
}

/** 방향키 이동. 빈 칸(검은 칸)은 건너뛴다. */
function moveCursor(state: GameState, puzzle: Puzzle, dRow: number, dCol: number): GameState {
  let row = state.cursor.row;
  let col = state.cursor.col;

  for (let step = 0; step < Math.max(puzzle.rows, puzzle.cols); step++) {
    row += dRow;
    col += dCol;
    if (row < 0 || col < 0 || row >= puzzle.rows || col >= puzzle.cols) return state;
    if (puzzle.cells[row][col]) {
      // 이동 방향과 선택 방향을 맞춘다.
      const direction: Direction = dCol !== 0 ? 'across' : 'down';
      const cell = puzzle.cells[row][col]!;
      const wordIndex = direction === 'across' ? cell.acrossIndex : cell.downIndex;
      return wordIndex === null
        ? selectCell(state, puzzle, row, col)
        : { ...state, cursor: { row, col, direction }, selectedWordIndex: wordIndex };
    }
  }
  return state;
}

/** 현재 단어 안에서 앞/뒤 칸으로 이동한다. */
function moveWithinWord(state: GameState, puzzle: Puzzle, delta: number): GameState {
  const placement = currentPlacement(state, puzzle);
  if (!placement) return state;
  const offset = offsetOfCursor(placement, state);
  if (offset === null) return state;
  const next = offset + delta;
  if (next < 0 || next >= placement.length) return state;
  const { row, col } = cellAt(placement, next);
  return { ...state, cursor: { ...state.cursor, row, col } };
}

function currentPlacement(state: GameState, puzzle: Puzzle): WordPlacement | null {
  if (state.selectedWordIndex === null) return null;
  return puzzle.words[state.selectedWordIndex] ?? null;
}

// ── 입력 ─────────────────────────────────────────────────────────────

/**
 * 글자 하나를 입력한다.
 * 입력 후 현재 단어가 모두 채워지면 자동으로 정답을 확인한다. (요구사항 29)
 */
function inputChar(
  state: GameState,
  puzzle: Puzzle,
  config: GameConfig,
  char: string,
): GameState {
  const { row, col } = state.cursor;
  if (!puzzle.cells[row]?.[col]) return state;
  if (state.lockedCells[row][col]) {
    // 잠긴 칸은 건너뛰고 다음 칸으로만 이동한다.
    return advanceCursor(state, puzzle);
  }

  const userGrid = cloneGrid(state.userGrid);
  userGrid[row][col] = char;

  let next: GameState = { ...state, userGrid };
  next = advanceCursor(next, puzzle);

  // 이 칸을 지나는 가로/세로 단어 모두를 확인 대상으로 삼는다.
  // 다만 오답으로 세는 것은 지금 작업 중인 단어뿐이다. (아래 checkWords 주석 참고)
  const cell = puzzle.cells[row][col]!;
  const targets = [cell.acrossIndex, cell.downIndex].filter((i): i is number => i !== null);
  return checkWords(next, puzzle, config, targets, { activeIndex: state.selectedWordIndex });
}

/** 현재 단어 안에서 다음 칸으로 커서를 옮긴다. 단어 끝이면 그대로 둔다. */
function advanceCursor(state: GameState, puzzle: Puzzle): GameState {
  const placement = currentPlacement(state, puzzle);
  if (!placement) return state;
  const offset = offsetOfCursor(placement, state);
  if (offset === null) return state;

  // 아직 비어 있는 다음 칸을 우선적으로 찾아간다.
  for (let i = offset + 1; i < placement.length; i++) {
    const { row, col } = cellAt(placement, i);
    if (!state.userGrid[row][col]) {
      return { ...state, cursor: { ...state.cursor, row, col } };
    }
  }
  if (offset + 1 < placement.length) {
    const { row, col } = cellAt(placement, offset + 1);
    return { ...state, cursor: { ...state.cursor, row, col } };
  }
  return state;
}

function backspace(state: GameState, puzzle: Puzzle): GameState {
  const { row, col } = state.cursor;
  const hasContent = Boolean(state.userGrid[row]?.[col]) && !state.lockedCells[row][col];

  if (hasContent) return clearCell(state, puzzle);

  // 현재 칸이 비어 있으면 이전 칸으로 이동한 뒤 지운다.
  const moved = moveWithinWord(state, puzzle, -1);
  if (moved === state) return state;
  return clearCell(moved, puzzle);
}

function clearCell(state: GameState, puzzle: Puzzle): GameState {
  const { row, col } = state.cursor;
  if (!puzzle.cells[row]?.[col]) return state;
  if (state.lockedCells[row][col]) return state;
  if (!state.userGrid[row][col]) return state;

  const userGrid = cloneGrid(state.userGrid);
  userGrid[row][col] = '';
  return { ...state, userGrid };
}

/** 엔터: 현재 단어를 즉시 채점한다. */
function submit(state: GameState, puzzle: Puzzle, config: GameConfig): GameState {
  if (state.selectedWordIndex === null) return state;
  return checkWords(state, puzzle, config, [state.selectedWordIndex], {
    force: true,
    activeIndex: state.selectedWordIndex,
  });
}

// ── 채점 ─────────────────────────────────────────────────────────────

/**
 * 지정된 단어들을 채점한다.
 * - 모두 채워졌고 정답이면 → 정답 처리 + 칸 잠금 + 성공 애니메이션
 * - 모두 채워졌고 오답이면 → 오답 1회 + 흔들림 (같은 입력으로는 다시 세지 않는다)
 *
 * `activeIndex` 는 사용자가 지금 작업 중인 단어다.
 * 가로 단어를 채우다가 교차 지점 때문에 세로 단어까지 우연히 채워지는 일이 흔한데,
 * 그때 의도하지도 않은 단어로 오답이 함께 깎이면 부당하게 느껴진다.
 * 그래서 **오답은 작업 중인 단어에만 적용**하고,
 * 우연히 완성된 교차 단어는 정답일 때만 처리한다.
 */
function checkWords(
  state: GameState,
  puzzle: Puzzle,
  config: GameConfig,
  wordIndexes: number[],
  options: { force?: boolean; activeIndex?: number | null } = {},
): GameState {
  let next = state;

  for (const wordIndex of wordIndexes) {
    const placement = puzzle.words[wordIndex];
    const progress = next.wordProgress[wordIndex];
    if (!placement || !progress || progress.solved) continue;

    const letters = toSyllables(placement.word);
    const entered = letters.map((_, offset) => {
      const { row, col } = cellAt(placement, offset);
      return next.userGrid[row][col] ?? '';
    });

    // 미완성인 단어는 채점하지 않는다. (강제 채점이어도 오답으로 세지 않는다)
    if (!entered.every((letter) => letter !== '')) continue;

    const signature = entered.join('');

    if (signature === placement.word) {
      next = markSolved(next, placement, wordIndex, false);
      continue;
    }

    const isActive = options.activeIndex === undefined || options.activeIndex === wordIndex;
    if (isActive && progress.lastWrongSignature !== signature) {
      next = markWrong(next, wordIndex, signature);
    }
  }

  next = refreshScore(next, puzzle);
  return applyEndConditions(next, puzzle, config);
}

function markSolved(
  state: GameState,
  placement: WordPlacement,
  wordIndex: number,
  revealedByHint: boolean,
): GameState {
  const lockedCells = cloneGrid(state.lockedCells);
  const userGrid = cloneGrid(state.userGrid);
  const letters = toSyllables(placement.word);

  letters.forEach((letter, offset) => {
    const { row, col } = cellAt(placement, offset);
    userGrid[row][col] = letter;
    lockedCells[row][col] = true;
  });

  const wordProgress = state.wordProgress.slice();
  wordProgress[wordIndex] = {
    ...wordProgress[wordIndex],
    solved: true,
    revealedByHint: wordProgress[wordIndex].revealedByHint || revealedByHint,
    lastWrongSignature: null,
  };

  return {
    ...state,
    userGrid,
    lockedCells,
    wordProgress,
    solvedFlash: { wordIndex, token: (state.solvedFlash?.token ?? 0) + 1 },
  };
}

function markWrong(state: GameState, wordIndex: number, signature: string): GameState {
  const wordProgress = state.wordProgress.slice();
  wordProgress[wordIndex] = {
    ...wordProgress[wordIndex],
    mistakes: wordProgress[wordIndex].mistakes + 1,
    lastWrongSignature: signature,
  };

  return {
    ...state,
    wordProgress,
    mistakes: state.mistakes + 1,
    shake: { wordIndex, token: (state.shake?.token ?? 0) + 1 },
  };
}

// ── 힌트 ─────────────────────────────────────────────────────────────

function useHint(
  state: GameState,
  puzzle: Puzzle,
  config: GameConfig,
  hintType: HintType,
): GameState {
  const resolution = resolveHint(state, puzzle, hintType, config);
  if (!resolution) return state;

  const { wordIndex } = resolution;
  const placement = puzzle.words[wordIndex];
  const userGrid = cloneGrid(state.userGrid);
  const lockedCells = cloneGrid(state.lockedCells);

  for (const { row, col, letter } of resolution.letters) {
    userGrid[row][col] = letter;
    lockedCells[row][col] = true;
  }

  const wordProgress = state.wordProgress.slice();
  wordProgress[wordIndex] = {
    ...wordProgress[wordIndex],
    revealedOffsets: [
      ...wordProgress[wordIndex].revealedOffsets,
      ...resolution.letters.map((l) => l.offset),
    ],
    initialsRevealed:
      wordProgress[wordIndex].initialsRevealed || resolution.type === 'revealInitials',
    // 힌트로 글자가 채워졌으므로 이전 오답 입력 기록은 무효화한다.
    lastWrongSignature: null,
  };

  const revealedInitials = resolution.initials
    ? { ...state.revealedInitials, [wordIndex]: resolution.initials }
    : state.revealedInitials;

  let next: GameState = {
    ...state,
    userGrid,
    lockedCells,
    wordProgress,
    revealedInitials,
    hintsUsed: [
      ...state.hintsUsed,
      {
        type: resolution.type,
        order: state.hintsUsed.length,
        wordIndex,
        cost: resolution.cost,
        letterOffset: resolution.letters[0]?.offset,
      },
    ],
  };

  if (resolution.revealedWord && placement) {
    next = markSolved(next, placement, wordIndex, true);
  } else {
    // 힌트로 마지막 칸이 채워졌다면 자동 채점한다.
    next = checkWords(next, puzzle, config, [wordIndex], { activeIndex: wordIndex });
    return next;
  }

  next = refreshScore(next, puzzle);
  return applyEndConditions(next, puzzle, config);
}

// ── 점수 / 종료 판정 ──────────────────────────────────────────────────

function refreshScore(state: GameState, puzzle: Puzzle): GameState {
  const completed = state.wordProgress.every((p) => p.solved);
  const breakdown = computeScore({
    puzzle,
    wordProgress: state.wordProgress,
    mistakes: state.mistakes,
    hintsUsed: state.hintsUsed,
    elapsedMs: state.elapsedMs,
    completed,
  });
  return state.score === breakdown.total ? state : { ...state, score: breakdown.total };
}

/**
 * 게임 종료 판정. (요구사항 28)
 * - 모든 단어를 맞히면 COMPLETED
 * - 오답이 `mistakes.max` 를 초과하면(= max+1 번째) 즉시 GAME_OVER
 */
function applyEndConditions(state: GameState, puzzle: Puzzle, config: GameConfig): GameState {
  if (state.mistakes >= gameOverAtMistake(config)) {
    return finish(state, puzzle, 'GAME_OVER', Date.now());
  }
  if (state.wordProgress.every((p) => p.solved)) {
    return finish(state, puzzle, 'COMPLETED', Date.now());
  }
  return state;
}

function finish(
  state: GameState,
  puzzle: Puzzle,
  status: Extract<GameStatus, 'COMPLETED' | 'GAME_OVER'>,
  now: number,
): GameState {
  const completed = status === 'COMPLETED';
  const breakdown = computeScore({
    puzzle,
    wordProgress: state.wordProgress,
    mistakes: state.mistakes,
    hintsUsed: state.hintsUsed,
    elapsedMs: state.elapsedMs,
    completed,
  });
  return { ...state, status, score: breakdown.total, finishedAt: now };
}

// ── 파생 정보 ────────────────────────────────────────────────────────

/** 퍼즐 진행률 0~1. */
export function getProgress(state: GameState): number {
  if (state.wordProgress.length === 0) return 0;
  return state.wordProgress.filter((p) => p.solved).length / state.wordProgress.length;
}

export function getSolvedCount(state: GameState): number {
  return state.wordProgress.filter((p) => p.solved).length;
}

/** 결과 화면/기록/공유에 사용할 요약. (요구사항 32) */
export function toGameResult(
  state: GameState,
  puzzle: Puzzle,
  config: GameConfig = getGameConfig(),
): GameResult {
  return {
    puzzleId: puzzle.puzzleId,
    seed: puzzle.seed,
    status: state.status === 'COMPLETED' ? 'COMPLETED' : 'GAME_OVER',
    score: state.score,
    elapsedMs: state.elapsedMs,
    mistakes: state.mistakes,
    maxMistakes: config.mistakes.max,
    hintsUsed: state.hintsUsed.length,
    maxHints: config.hints.max,
    solvedWords: getSolvedCount(state),
    totalWords: puzzle.words.length,
    difficulty: puzzle.difficulty,
    playedAt: state.finishedAt ?? Date.now(),
  };
}

function cloneGrid<T>(grid: T[][]): T[][] {
  return grid.map((row) => row.slice());
}
