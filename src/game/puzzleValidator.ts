import { getGameConfig, getPuzzleConfig, type PuzzleConfig } from '@/config';
import type { Direction, Puzzle, WordPlacement } from '@/types';
import type { PlacedWord } from './layout';

/**
 * 퍼즐 검증 및 품질 평가. (요구사항 6·10)
 *
 * 배치 중간 결과(PlacedWord[])와 완성된 Puzzle 양쪽에 대해 동작하도록
 * 최소 공통 인터페이스(`WordLike`)를 기준으로 구현한다.
 */

/** 검증에 필요한 최소 정보. PlacedWord 와 WordPlacement 모두 만족한다. */
export interface WordLike {
  direction: Direction;
  length: number;
  row: number;
  col: number;
  word: string;
}

export interface LayoutStats {
  wordCount: number;
  acrossCount: number;
  downCount: number;
  /** 두 단어가 공유하는 칸의 개수. */
  intersections: number;
  rows: number;
  cols: number;
  /** 채워진 칸 수. */
  filledCells: number;
  /** 채운 칸 / 바운딩 박스 칸. */
  density: number;
  /** 긴 변 / 짧은 변. */
  aspectRatio: number;
  /** 교차점 / 단어 수. */
  intersectionRatio: number;
  /** 한 방향이 차지하는 최대 비율. */
  directionRatio: number;
  /** 교차점이 하나도 없는 고립 단어 수. */
  isolatedWords: number;
  /** 모든 단어가 하나로 연결되어 있는지. */
  connected: boolean;
  /** 같은 칸에 서로 다른 글자가 놓인 충돌 목록. */
  conflicts: Conflict[];
}

export interface Conflict {
  row: number;
  col: number;
  letters: string[];
}

/** PlacedWord[] → WordLike[] */
export function toWordLike(words: readonly PlacedWord[]): WordLike[] {
  return words.map((w) => ({
    direction: w.direction,
    length: w.length,
    row: w.row,
    col: w.col,
    word: w.entry.normalizedWord,
  }));
}

/** WordPlacement[] → WordLike[] */
export function placementsToWordLike(words: readonly WordPlacement[]): WordLike[] {
  return words.map((w) => ({
    direction: w.direction,
    length: w.length,
    row: w.startRow,
    col: w.startCol,
    word: w.word,
  }));
}

function cellsOf(word: WordLike): { row: number; col: number; letter: string }[] {
  const dRow = word.direction === 'down' ? 1 : 0;
  const dCol = word.direction === 'across' ? 1 : 0;
  const letters = Array.from(word.word);
  return letters.map((letter, i) => ({
    row: word.row + dRow * i,
    col: word.col + dCol * i,
    letter,
  }));
}

/** 배치 결과의 통계와 품질 지표를 계산한다. */
export function computeStats(words: readonly WordLike[]): LayoutStats {
  if (words.length === 0) {
    return {
      wordCount: 0,
      acrossCount: 0,
      downCount: 0,
      intersections: 0,
      rows: 0,
      cols: 0,
      filledCells: 0,
      density: 0,
      aspectRatio: 1,
      intersectionRatio: 0,
      directionRatio: 1,
      isolatedWords: 0,
      connected: false,
      conflicts: [],
    };
  }

  // 칸별로 어떤 단어들이 지나는지 모은다.
  const cellOwners = new Map<string, { words: number[]; letters: Set<string> }>();
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  words.forEach((word, index) => {
    for (const cell of cellsOf(word)) {
      const key = `${cell.row},${cell.col}`;
      let owner = cellOwners.get(key);
      if (!owner) {
        owner = { words: [], letters: new Set() };
        cellOwners.set(key, owner);
      }
      owner.words.push(index);
      owner.letters.add(cell.letter);

      minRow = Math.min(minRow, cell.row);
      maxRow = Math.max(maxRow, cell.row);
      minCol = Math.min(minCol, cell.col);
      maxCol = Math.max(maxCol, cell.col);
    }
  });

  const conflicts: Conflict[] = [];
  let intersections = 0;
  const adjacency: Set<number>[] = words.map(() => new Set<number>());

  for (const [key, owner] of cellOwners) {
    if (owner.letters.size > 1) {
      const [row, col] = key.split(',').map(Number);
      conflicts.push({ row, col, letters: [...owner.letters] });
    }
    if (owner.words.length > 1) {
      intersections++;
      for (const a of owner.words) {
        for (const b of owner.words) if (a !== b) adjacency[a].add(b);
      }
    }
  }

  // 연결성 검사 (요구사항 9의 7단계)
  const visited = new Set<number>([0]);
  const queue = [0];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency[current]) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  const acrossCount = words.filter((w) => w.direction === 'across').length;
  const downCount = words.length - acrossCount;
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;
  const filledCells = cellOwners.size;

  return {
    wordCount: words.length,
    acrossCount,
    downCount,
    intersections,
    rows,
    cols,
    filledCells,
    density: filledCells / Math.max(1, rows * cols),
    aspectRatio: Math.max(rows, cols) / Math.max(1, Math.min(rows, cols)),
    intersectionRatio: intersections / words.length,
    directionRatio: Math.max(acrossCount, downCount) / words.length,
    isolatedWords: adjacency.filter((set) => set.size === 0).length,
    connected: visited.size === words.length,
    conflicts,
  };
}

export interface QualityResult {
  ok: boolean;
  /** 사람이 읽을 수 있는 실패 사유. */
  issues: string[];
  /** 0 이상의 모양 점수. 높을수록 좋은 퍼즐. */
  shapeScore: number;
  stats: LayoutStats;
}

/**
 * 품질 기준 검사. (요구사항 10)
 * @param strict false 면 최소 조건(연결성/충돌/단어 수)만 확인한다.
 */
export function checkQuality(
  words: readonly WordLike[],
  options: { strict?: boolean; config?: PuzzleConfig } = {},
): QualityResult {
  const { strict = true } = options;
  const config = options.config ?? getPuzzleConfig();
  const gameConfig = getGameConfig();
  const stats = computeStats(words);
  const issues: string[] = [];

  // ── 반드시 지켜야 하는 조건 ──────────────────────────────
  if (stats.wordCount < gameConfig.words.min) {
    issues.push(`단어 수 부족 (${stats.wordCount} < ${gameConfig.words.min})`);
  }
  if (stats.wordCount > gameConfig.words.max) {
    issues.push(`단어 수 초과 (${stats.wordCount} > ${gameConfig.words.max})`);
  }
  if (stats.conflicts.length > 0) {
    issues.push(`글자 충돌 ${stats.conflicts.length}건`);
  }
  if (!stats.connected) {
    issues.push('단어들이 하나로 연결되어 있지 않음');
  }
  if (stats.isolatedWords > 0) {
    issues.push(`고립 단어 ${stats.isolatedWords}개`);
  }

  // ── 모양 품질 조건 (strict 일 때만) ──────────────────────
  if (strict) {
    if (stats.intersectionRatio < config.quality.minIntersectionRatio) {
      issues.push(`교차가 너무 적음 (${stats.intersectionRatio.toFixed(2)})`);
    }
    if (stats.directionRatio > config.quality.maxDirectionRatio) {
      issues.push(`가로/세로가 한쪽으로 치우침 (${stats.directionRatio.toFixed(2)})`);
    }
    if (stats.aspectRatio > config.quality.maxAspectRatio) {
      issues.push(`형태가 지나치게 길쭉함 (${stats.aspectRatio.toFixed(2)})`);
    }
    if (stats.density < config.quality.minDensity) {
      issues.push(`퍼즐이 지나치게 성김 (${stats.density.toFixed(2)})`);
    }
  }

  return { ok: issues.length === 0, issues, shapeScore: evaluateShape(stats, config), stats };
}

/**
 * 퍼즐 모양 점수. (요구사항 9의 9단계)
 * 여러 후보 중 "가장 자연스럽고 재미있는" 하나를 고르는 기준이다.
 */
export function evaluateShape(stats: LayoutStats, config: PuzzleConfig = getPuzzleConfig()): number {
  if (stats.wordCount === 0) return 0;
  const gameConfig = getGameConfig();
  const w = config.quality.weights;

  // 선호 범위 안이면 만점, 벗어나면 선형 감점.
  const { preferredMin, preferredMax, min, max } = gameConfig.words;
  const countScore =
    stats.wordCount >= preferredMin && stats.wordCount <= preferredMax
      ? 1
      : stats.wordCount < preferredMin
        ? Math.max(0, (stats.wordCount - min) / Math.max(1, preferredMin - min))
        : Math.max(0, (max - stats.wordCount) / Math.max(1, max - preferredMax));

  // 교차가 많을수록 좋지만 1.4를 넘으면 더 이상 가산하지 않는다.
  const intersectionScore = Math.min(1, stats.intersectionRatio / 1.4);

  // 가로:세로가 50:50에 가까울수록 만점.
  const balanceScore = 1 - Math.min(1, (stats.directionRatio - 0.5) / 0.5);

  // 격자가 작을수록(컴팩트할수록) 모바일에 유리.
  const area = Math.max(1, stats.rows * stats.cols);
  const compactScore = Math.max(0, 1 - area / (config.grid.maxRows * config.grid.maxCols));

  // 정사각형에 가까울수록 만점.
  const aspectScore = Math.max(0, 1 - (stats.aspectRatio - 1) / 1.2);

  // 밀도가 지나치게 낮거나 높지 않은 중간 지점을 선호.
  const densityScore = 1 - Math.min(1, Math.abs(stats.density - 0.4) / 0.4);

  return (
    countScore * w.wordCount +
    intersectionScore * w.intersectionRatio +
    balanceScore * w.balance +
    compactScore * w.compactness +
    aspectScore * w.aspect +
    densityScore * w.density
  );
}

/**
 * 완성된 퍼즐 전체를 검증한다. (테스트 및 개발 중 안전망)
 */
export function validatePuzzle(puzzle: Puzzle): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const quality = checkQuality(placementsToWordLike(puzzle.words), { strict: false });
  issues.push(...quality.issues);

  // 격자와 배치 정보가 일치하는지 교차 확인한다.
  for (const placement of puzzle.words) {
    const dRow = placement.direction === 'down' ? 1 : 0;
    const dCol = placement.direction === 'across' ? 1 : 0;
    const letters = Array.from(placement.word);
    if (letters.length !== placement.length) {
      issues.push(`${placement.word}: length 필드 불일치`);
    }
    letters.forEach((letter, i) => {
      const r = placement.startRow + dRow * i;
      const c = placement.startCol + dCol * i;
      if (r < 0 || c < 0 || r >= puzzle.rows || c >= puzzle.cols) {
        issues.push(`${placement.word}: 격자 밖으로 벗어남 (${r},${c})`);
        return;
      }
      if (puzzle.grid[r][c] !== letter) {
        issues.push(`${placement.word}: (${r},${c}) 격자 글자 불일치`);
      }
    });
  }

  return { valid: issues.length === 0, issues };
}
