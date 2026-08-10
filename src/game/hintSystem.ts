import { getGameConfig, type GameConfig } from '@/config';
import type { GameState, HintType, Puzzle, WordPlacement } from '@/types';
import { getInitials, toSyllables } from '@/utils/hangul';

/**
 * 힌트 시스템. (요구사항 23·24·25·26)
 *
 * - 한 게임에서 최대 `hints.max` 회
 * - 첫 힌트는 무료, 이후는 순번별 배율로 점수 차감
 * - 종류: 한 글자 공개 / 초성 공개 / 정답 공개  (카테고리 공개 힌트는 없다)
 *
 * 차감 점수는 전부 gameConfig 에서 오며 이 파일에도 숫자를 쓰지 않는다.
 */

export const HINT_TYPES: HintType[] = ['revealLetter', 'revealInitials', 'revealWord'];

/** n번째(0-based) 힌트로 특정 종류를 썼을 때의 차감 점수. */
export function hintCost(
  type: HintType,
  order: number,
  config: GameConfig = getGameConfig(),
): number {
  if (order < config.hints.freeCount) return 0;
  const multiplier = config.hints.costMultiplierByOrder[order] ?? 1;
  return Math.round(config.hints.baseCost[type] * multiplier);
}

export interface HintOption {
  type: HintType;
  label: string;
  description: string;
  /** 지금 사용할 경우 차감될 점수. */
  cost: number;
  /** 선택 가능한지. */
  enabled: boolean;
  /** 사용할 수 없는 이유(있을 때). */
  disabledReason?: string;
}

export interface HintAvailability {
  /** 남은 힌트 횟수. */
  remaining: number;
  used: number;
  max: number;
  /** 힌트를 하나라도 쓸 수 있는지. */
  canUse: boolean;
  options: HintOption[];
}

/** 현재 상태에서 사용할 수 있는 힌트 목록과 각각의 차감 점수. */
export function getHintAvailability(
  state: GameState,
  puzzle: Puzzle,
  config: GameConfig = getGameConfig(),
): HintAvailability {
  const used = state.hintsUsed.length;
  const remaining = Math.max(0, config.hints.max - used);
  const wordIndex = state.selectedWordIndex;
  const progress = wordIndex !== null ? state.wordProgress[wordIndex] : null;
  const placement = wordIndex !== null ? puzzle.words[wordIndex] : null;

  const options = HINT_TYPES.map<HintOption>((type) => {
    const cost = hintCost(type, used, config);
    let enabled = remaining > 0 && state.status === 'PLAYING' && placement !== null;
    let disabledReason: string | undefined;

    if (remaining === 0) disabledReason = '힌트를 모두 사용했습니다.';
    else if (!placement) disabledReason = '먼저 문제를 선택해 주세요.';
    else if (progress?.solved) {
      enabled = false;
      disabledReason = '이미 푼 문제입니다.';
    } else if (type === 'revealInitials' && progress?.initialsRevealed) {
      enabled = false;
      disabledReason = '이미 초성을 공개했습니다.';
    } else if (type === 'revealLetter' && placement && progress) {
      if (findRevealTarget(placement, state, wordIndex!) === null) {
        enabled = false;
        disabledReason = '공개할 칸이 남아 있지 않습니다.';
      }
    }

    return {
      type,
      label: config.hints.label[type],
      description: config.hints.description[type],
      cost,
      enabled,
      disabledReason,
    };
  });

  return {
    remaining,
    used,
    max: config.hints.max,
    canUse: remaining > 0 && state.status === 'PLAYING',
    options,
  };
}

/** 힌트 적용 결과. gameState 리듀서가 이 값을 상태에 반영한다. */
export interface HintResolution {
  type: HintType;
  wordIndex: number;
  cost: number;
  /** 격자에 채워 넣을 칸들. */
  letters: { row: number; col: number; letter: string; offset: number }[];
  /** 초성 공개인 경우의 초성 문자열. */
  initials?: string;
  /** 단어 전체를 공개했는지. */
  revealedWord: boolean;
}

/**
 * 힌트를 계산한다. 상태를 변경하지 않는 순수 함수다.
 * 사용할 수 없는 상황이면 null 을 반환한다.
 */
export function resolveHint(
  state: GameState,
  puzzle: Puzzle,
  type: HintType,
  config: GameConfig = getGameConfig(),
): HintResolution | null {
  const wordIndex = state.selectedWordIndex;
  if (wordIndex === null) return null;
  const placement = puzzle.words[wordIndex];
  if (!placement) return null;
  if (state.hintsUsed.length >= config.hints.max) return null;
  if (state.wordProgress[wordIndex]?.solved) return null;

  const cost = hintCost(type, state.hintsUsed.length, config);

  switch (type) {
    case 'revealLetter': {
      const offset = findRevealTarget(placement, state, wordIndex);
      if (offset === null) return null;
      const { row, col } = cellAt(placement, offset);
      return {
        type,
        wordIndex,
        cost,
        letters: [{ row, col, letter: toSyllables(placement.word)[offset], offset }],
        revealedWord: false,
      };
    }

    case 'revealInitials': {
      if (state.wordProgress[wordIndex]?.initialsRevealed) return null;
      return {
        type,
        wordIndex,
        cost,
        letters: [],
        initials: getInitials(placement.word),
        revealedWord: false,
      };
    }

    case 'revealWord': {
      const letters = toSyllables(placement.word).map((letter, offset) => ({
        ...cellAt(placement, offset),
        letter,
        offset,
      }));
      return { type, wordIndex, cost, letters, revealedWord: true };
    }

    default: {
      const exhaustive: never = type;
      throw new Error(`알 수 없는 힌트 종류: ${String(exhaustive)}`);
    }
  }
}

/**
 * "한 글자 공개" 힌트로 공개할 칸을 고른다.
 * 커서가 이 단어 위에 있고 그 칸이 비어 있으면 그 칸을, 아니면 첫 빈 칸을 고른다.
 */
function findRevealTarget(placement: WordPlacement, state: GameState, wordIndex: number): number | null {
  const length = placement.length;
  const cursorOffset = offsetOfCursor(placement, state);

  const isOpen = (offset: number) => {
    const { row, col } = cellAt(placement, offset);
    if (state.lockedCells[row]?.[col]) return false;
    return state.userGrid[row]?.[col] !== toSyllables(placement.word)[offset];
  };

  if (
    cursorOffset !== null &&
    state.selectedWordIndex === wordIndex &&
    cursorOffset >= 0 &&
    cursorOffset < length &&
    isOpen(cursorOffset)
  ) {
    return cursorOffset;
  }

  for (let offset = 0; offset < length; offset++) {
    if (isOpen(offset)) return offset;
  }
  return null;
}

/** 단어의 offset 번째 칸 좌표. */
export function cellAt(placement: WordPlacement, offset: number): { row: number; col: number } {
  return placement.direction === 'across'
    ? { row: placement.startRow, col: placement.startCol + offset }
    : { row: placement.startRow + offset, col: placement.startCol };
}

/** 커서가 단어의 몇 번째 칸에 있는지. 단어 밖이면 null. */
export function offsetOfCursor(placement: WordPlacement, state: GameState): number | null {
  const { row, col } = state.cursor;
  if (placement.direction === 'across') {
    if (row !== placement.startRow) return null;
    const offset = col - placement.startCol;
    return offset >= 0 && offset < placement.length ? offset : null;
  }
  if (col !== placement.startCol) return null;
  const offset = row - placement.startRow;
  return offset >= 0 && offset < placement.length ? offset : null;
}
