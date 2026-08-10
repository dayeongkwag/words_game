import type { Direction, PuzzleDifficulty } from './puzzle';

/** 게임 상태 머신. (요구사항 51) */
export type GameStatus =
  | 'INITIALIZING'
  | 'PLAYING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'GAME_OVER';

/** 힌트 종류. (요구사항 24 — 카테고리 공개 힌트는 없다) */
export type HintType = 'revealLetter' | 'revealInitials' | 'revealWord';

/** 사용된 힌트 1건의 기록. */
export interface HintUsage {
  type: HintType;
  /** 몇 번째로 사용한 힌트인지 (0-based). 차감 배율 계산에 쓰인다. */
  order: number;
  /** 대상 단어 인덱스. */
  wordIndex: number;
  /** 실제 차감된 점수. */
  cost: number;
  /** revealLetter 인 경우 공개된 칸의 단어 내 위치. */
  letterOffset?: number;
}

/** 커서(현재 선택 위치와 방향). */
export interface Cursor {
  row: number;
  col: number;
  direction: Direction;
}

/** 단어별 진행 상태. */
export interface WordProgress {
  /** 정답 처리 완료. */
  solved: boolean;
  /** 힌트로 정답이 공개됨(점수는 힌트 차감 반영). */
  revealedByHint: boolean;
  /** 이 단어에서 발생한 오답 횟수. */
  mistakes: number;
  /** 힌트로 공개된 칸의 offset 목록. */
  revealedOffsets: number[];
  /** 초성이 공개되었는지. */
  initialsRevealed: boolean;
  /**
   * 이미 오답으로 처리한 입력 조합.
   * 같은 입력으로 오답이 반복 집계되는 것을 막는다.
   */
  lastWrongSignature: string | null;
}

/** 게임 전체 상태. */
export interface GameState {
  status: GameStatus;
  /** 사용자가 입력한 격자. 빈 칸/미입력은 ''. */
  userGrid: string[][];
  /** 힌트로 공개되었거나 정답 처리되어 수정할 수 없는 칸. */
  lockedCells: boolean[][];
  /** 초성 힌트를 사용한 단어의 초성 문자열. UI 는 정답을 모르므로 여기서 받는다. */
  revealedInitials: Record<number, string>;
  cursor: Cursor;
  /** 현재 선택된 단어 인덱스 (Puzzle.words 기준). 없으면 null. */
  selectedWordIndex: number | null;
  wordProgress: WordProgress[];
  /** 총 오답 횟수. */
  mistakes: number;
  hintsUsed: HintUsage[];
  score: number;
  /** 누적 플레이 시간(ms). PAUSED 동안은 증가하지 않는다. */
  elapsedMs: number;
  /** 마지막으로 흔들림 애니메이션을 트리거한 단어 인덱스와 토큰. */
  shake: { wordIndex: number; token: number } | null;
  /** 방금 정답 처리된 단어(성공 애니메이션 트리거용). */
  solvedFlash: { wordIndex: number; token: number } | null;
  startedAt: number | null;
  finishedAt: number | null;
}

/** 게임 결과 요약. 결과 화면 / 기록 저장 / 공유에 사용. */
export interface GameResult {
  puzzleId: string;
  seed: string;
  status: Extract<GameStatus, 'COMPLETED' | 'GAME_OVER'>;
  score: number;
  elapsedMs: number;
  mistakes: number;
  maxMistakes: number;
  hintsUsed: number;
  maxHints: number;
  solvedWords: number;
  totalWords: number;
  difficulty: PuzzleDifficulty;
  /** 기록 저장 시각(epoch ms). */
  playedAt: number;
}

/** localStorage 에 저장되는 개인 기록 1건. */
export interface PlayRecord extends GameResult {
  recordId: string;
}
