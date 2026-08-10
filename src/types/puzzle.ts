import type { WordCategory, WordDifficulty } from './word';

/** 단어 배치 방향. */
export type Direction = 'across' | 'down';

/**
 * 격자에 배치된 단어 하나.
 * 정답 문자열(`word`)을 포함하므로 UI 로 그대로 내려보내지 않는다.
 * (→ `PuzzleView` 참고)
 */
export interface WordPlacement {
  /** 화면에 표시되는 문제 번호. 격자 위치 기준으로 부여된다. */
  number: number;
  /** 원본 단어 ID (재현 및 DB 추적용). */
  wordId: string;
  /** 정답 단어(정규화된 형태). */
  word: string;
  direction: Direction;
  startRow: number;
  startCol: number;
  length: number;
  /** 문제 설명. */
  clue: string;
  difficulty: WordDifficulty;
  category: WordCategory;
}

/** 격자 한 칸의 정적 정보(정답 포함). */
export interface PuzzleCell {
  row: number;
  col: number;
  /** 정답 글자. */
  answer: string;
  /** 이 칸을 지나는 가로 단어의 인덱스 (Puzzle.words 기준). 없으면 null. */
  acrossIndex: number | null;
  /** 이 칸을 지나는 세로 단어의 인덱스. 없으면 null. */
  downIndex: number | null;
  /** 이 칸에서 시작하는 단어가 있으면 그 번호. 아니면 null. */
  number: number | null;
}

/** 퍼즐 난이도 평가 결과. */
export interface PuzzleDifficulty {
  /** 1.0 ~ 5.0 의 평균 난이도. */
  score: number;
  /** 사용자에게 보여줄 체감 난이도. */
  label: '쉬움' | '보통' | '어려움';
}

/** 퍼즐 생성 결과에 대한 부가 정보. */
export interface PuzzleMetadata {
  /** 퍼즐 생성기 버전. 알고리즘이 바뀌면 올린다(= 재현 호환성 키). */
  generatorVersion: string;
  /** 생성에 사용된 단어 데이터셋 버전. */
  dictVersion: string;
  /** 생성 시도 횟수. */
  attempts: number;
  /** 후보 퍼즐 중 선택된 퍼즐의 모양 점수. */
  shapeScore: number;
  /** 가로 단어 수. */
  acrossCount: number;
  /** 세로 단어 수. */
  downCount: number;
  /** 교차점 개수. */
  intersectionCount: number;
  /** 채워진 칸 수 / 격자 전체 칸 수. */
  density: number;
  /** fallback 퍼즐로 대체되었는지 여부. */
  isFallback: boolean;
}

/** 퍼즐 하나의 완전한 정의(정답 포함). */
export interface Puzzle {
  /** 공유 링크에 실리는 짧은 식별자. seed 로부터 결정론적으로 만들어진다. */
  puzzleId: string;
  /** 퍼즐 생성에 사용된 시드 문자열. */
  seed: string;
  rows: number;
  cols: number;
  words: WordPlacement[];
  /**
   * 정답 격자. 빈 칸은 null.
   * `grid[row][col]`
   */
  grid: (string | null)[][];
  /** 좌표 → 칸 정보. 빈 칸은 null. */
  cells: (PuzzleCell | null)[][];
  difficulty: PuzzleDifficulty;
  metadata: PuzzleMetadata;
  /**
   * 재현 검증용 체크섬. 공유 링크에 포함되며,
   * 링크를 열었을 때 동일 퍼즐이 만들어졌는지 확인한다.
   */
  checksum: string;
}

/**
 * UI 로 전달되는 퍼즐 뷰. 정답 데이터를 포함하지 않는다.
 * (요구사항 53: 정답 데이터와 UI 상태 분리)
 */
export interface PuzzleView {
  puzzleId: string;
  rows: number;
  cols: number;
  /** `blocked[row][col] === true` 면 검은 칸(사용하지 않는 칸). */
  blocked: boolean[][];
  /** 칸에 표시할 문제 번호. 없으면 null. */
  numbers: (number | null)[][];
  /** 좌표별로 지나는 단어 인덱스. */
  cellWords: ({ across: number | null; down: number | null } | null)[][];
  /** 정답이 제거된 문제 목록. */
  clues: ClueView[];
  difficulty: PuzzleDifficulty;
}

/** UI 에 표시되는 문제(정답 없음). */
export interface ClueView {
  index: number;
  number: number;
  direction: Direction;
  clue: string;
  length: number;
  startRow: number;
  startCol: number;
  difficulty: WordDifficulty;
}

/**
 * 퍼즐 스냅샷. 단어 DB가 바뀌어도 과거 공유 링크를 복원할 수 있도록
 * 배치 정보를 그대로 직렬화한 형태다. (요구사항 37)
 */
export interface PuzzleSnapshot {
  v: number;
  id: string;
  seed: string;
  rows: number;
  cols: number;
  /** [wordId, word, direction(0=across,1=down), startRow, startCol, difficulty, clue] */
  words: [string, string, 0 | 1, number, number, number, string][];
}
