import type { Direction, WordEntry } from '@/types';
import { toSyllables } from '@/utils/hangul';

/**
 * 격자 배치 엔진.
 *
 * 퍼즐 생성 알고리즘(요구사항 9)의 3~6단계 — 교차 가능 글자 탐색, 방향 결정,
 * 충돌 검사, 격자 배치 — 를 담당한다. 무작위성은 전혀 포함하지 않으며,
 * 어떤 후보를 고를지는 호출자(puzzleGenerator)가 시드 RNG로 결정한다.
 */

export interface PlacedWord {
  entry: WordEntry;
  /** 음절 배열. 매번 다시 쪼개지 않도록 캐시한다. */
  syllables: string[];
  direction: Direction;
  row: number;
  col: number;
  length: number;
  /** 이 단어가 다른 단어와 만나는 교차점 개수. */
  intersections: number;
}

export interface PlacementCandidate {
  entry: WordEntry;
  direction: Direction;
  row: number;
  col: number;
  intersections: number;
  /** 배치 점수. 높을수록 좋다. */
  score: number;
}

export interface Bounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export interface PlacementWeights {
  intersection: number;
  centrality: number;
  boundingGrowth: number;
  balance: number;
}

const EMPTY_BOUNDS: Bounds = {
  minRow: Number.POSITIVE_INFINITY,
  maxRow: Number.NEGATIVE_INFINITY,
  minCol: Number.POSITIVE_INFINITY,
  maxCol: Number.NEGATIVE_INFINITY,
};

export class LayoutBuilder {
  readonly rows: number;
  readonly cols: number;

  /** 각 칸의 글자. 비어 있으면 null. */
  private readonly letters: (string | null)[][];
  /** 각 칸을 지나는 가로 단어의 인덱스(placed 기준). */
  private readonly acrossOwner: (number | null)[][];
  private readonly downOwner: (number | null)[][];
  /** 글자 → 그 글자가 놓인 좌표 목록. 교차점 탐색을 O(1)에 가깝게 만든다. */
  private readonly letterIndex = new Map<string, { row: number; col: number }[]>();

  readonly placed: PlacedWord[] = [];
  private usedIds = new Set<string>();
  private usedWords = new Set<string>();
  private bounds: Bounds = { ...EMPTY_BOUNDS };

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.letters = createMatrix<string | null>(rows, cols, null);
    this.acrossOwner = createMatrix<number | null>(rows, cols, null);
    this.downOwner = createMatrix<number | null>(rows, cols, null);
  }

  get wordCount(): number {
    return this.placed.length;
  }

  getBounds(): Bounds {
    return { ...this.bounds };
  }

  isUsed(entry: WordEntry): boolean {
    return this.usedIds.has(entry.id) || this.usedWords.has(entry.normalizedWord);
  }

  /** 총 교차점 개수. */
  get intersectionCount(): number {
    let total = 0;
    for (const word of this.placed) total += word.intersections;
    // 교차점 하나는 두 단어에서 각각 세어지므로 2로 나눈다.
    return total / 2;
  }

  countByDirection(direction: Direction): number {
    return this.placed.filter((w) => w.direction === direction).length;
  }

  /**
   * 배치 가능 여부를 검사한다.
   * @returns 교차점 개수. 배치할 수 없으면 null.
   */
  canPlace(
    syllables: string[],
    direction: Direction,
    row: number,
    col: number,
    allowNoIntersection = false,
  ): number | null {
    const length = syllables.length;
    const dRow = direction === 'down' ? 1 : 0;
    const dCol = direction === 'across' ? 1 : 0;

    const endRow = row + dRow * (length - 1);
    const endCol = col + dCol * (length - 1);
    if (row < 0 || col < 0 || endRow >= this.rows || endCol >= this.cols) return null;

    // 단어 앞뒤 칸은 비어 있어야 한다. (다른 단어와 이어 붙어 새 단어가 생기는 것 방지)
    if (this.letterAt(row - dRow, col - dCol) !== null) return null;
    if (this.letterAt(endRow + dRow, endCol + dCol) !== null) return null;

    const sameOwner = direction === 'across' ? this.acrossOwner : this.downOwner;
    const crossOwner = direction === 'across' ? this.downOwner : this.acrossOwner;

    let intersections = 0;
    for (let i = 0; i < length; i++) {
      const r = row + dRow * i;
      const c = col + dCol * i;

      // 같은 방향의 단어가 이미 이 칸을 차지하고 있으면 나란히 겹치는 것이므로 불가.
      if (sameOwner[r][c] !== null) return null;

      const existing = this.letters[r][c];
      if (existing !== null) {
        // 충돌 검사: 같은 칸에 다른 글자가 오면 안 된다. (요구사항 10)
        if (existing !== syllables[i]) return null;
        // 기존 글자는 반드시 직교 방향 단어의 것이어야 한다.
        if (crossOwner[r][c] === null) return null;
        intersections++;
      } else {
        // 빈 칸이라면 직교 방향 이웃도 비어 있어야 한다.
        // (그렇지 않으면 의도치 않은 두 글자 단어가 만들어진다)
        if (this.letterAt(r - dCol, c - dRow) !== null) return null;
        if (this.letterAt(r + dCol, c + dRow) !== null) return null;
      }
    }

    if (intersections === 0 && !allowNoIntersection) return null;
    return intersections;
  }

  /** 실제로 배치한다. 사전에 canPlace 로 검증되어 있어야 한다. */
  place(entry: WordEntry, direction: Direction, row: number, col: number): PlacedWord {
    const syllables = toSyllables(entry.normalizedWord);
    const index = this.placed.length;
    const dRow = direction === 'down' ? 1 : 0;
    const dCol = direction === 'across' ? 1 : 0;
    const owner = direction === 'across' ? this.acrossOwner : this.downOwner;
    const crossOwner = direction === 'across' ? this.downOwner : this.acrossOwner;

    let intersections = 0;
    for (let i = 0; i < syllables.length; i++) {
      const r = row + dRow * i;
      const c = col + dCol * i;
      if (this.letters[r][c] === null) {
        this.letters[r][c] = syllables[i];
        this.addLetterIndex(syllables[i], r, c);
      } else {
        intersections++;
        const crossIndex = crossOwner[r][c];
        if (crossIndex !== null) this.placed[crossIndex].intersections++;
      }
      owner[r][c] = index;
    }

    const placed: PlacedWord = {
      entry,
      syllables,
      direction,
      row,
      col,
      length: syllables.length,
      intersections,
    };
    this.placed.push(placed);
    this.usedIds.add(entry.id);
    this.usedWords.add(entry.normalizedWord);

    this.bounds = {
      minRow: Math.min(this.bounds.minRow, row),
      maxRow: Math.max(this.bounds.maxRow, row + dRow * (syllables.length - 1)),
      minCol: Math.min(this.bounds.minCol, col),
      maxCol: Math.max(this.bounds.maxCol, col + dCol * (syllables.length - 1)),
    };

    return placed;
  }

  /**
   * 단어 하나에 대해 가능한 모든 배치를 찾아 점수와 함께 돌려준다.
   * (요구사항 9의 3~5단계)
   */
  findPlacements(
    entry: WordEntry,
    weights: PlacementWeights,
    maxSize: { rows: number; cols: number },
  ): PlacementCandidate[] {
    if (this.isUsed(entry)) return [];
    const syllables = toSyllables(entry.normalizedWord);
    const results: PlacementCandidate[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < syllables.length; i++) {
      const anchors = this.letterIndex.get(syllables[i]);
      if (!anchors) continue;

      for (const anchor of anchors) {
        // 가로 배치: 교차 글자가 i번째가 되도록 시작 열을 뒤로 민다.
        for (const direction of ['across', 'down'] as const) {
          const row = direction === 'across' ? anchor.row : anchor.row - i;
          const col = direction === 'across' ? anchor.col - i : anchor.col;
          const key = `${direction}:${row}:${col}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const intersections = this.canPlace(syllables, direction, row, col);
          if (intersections === null) continue;

          const score = this.scorePlacement(
            syllables.length,
            direction,
            row,
            col,
            intersections,
            weights,
            maxSize,
          );
          if (score === null) continue;
          results.push({ entry, direction, row, col, intersections, score });
        }
      }
    }

    return results;
  }

  /**
   * 배치 후보의 점수. 최종 크기 제한을 넘기면 null(배치 불가)을 반환한다.
   */
  private scorePlacement(
    length: number,
    direction: Direction,
    row: number,
    col: number,
    intersections: number,
    weights: PlacementWeights,
    maxSize: { rows: number; cols: number },
  ): number | null {
    const dRow = direction === 'down' ? 1 : 0;
    const dCol = direction === 'across' ? 1 : 0;
    const endRow = row + dRow * (length - 1);
    const endCol = col + dCol * (length - 1);

    const next: Bounds = {
      minRow: Math.min(this.bounds.minRow, row),
      maxRow: Math.max(this.bounds.maxRow, endRow),
      minCol: Math.min(this.bounds.minCol, col),
      maxCol: Math.max(this.bounds.maxCol, endCol),
    };
    const nextRows = next.maxRow - next.minRow + 1;
    const nextCols = next.maxCol - next.minCol + 1;
    // 화면에 들어오는 크기를 유지한다. (요구사항 10)
    if (nextRows > maxSize.rows || nextCols > maxSize.cols) return null;

    const currentArea = this.boundsArea(this.bounds);
    const growth = nextRows * nextCols - currentArea;

    // 격자 중심에 가까울수록 가산점 → 퍼즐이 한쪽으로 흐르지 않는다.
    const centerRow = this.rows / 2;
    const centerCol = this.cols / 2;
    const midRow = (row + endRow) / 2;
    const midCol = (col + endCol) / 2;
    const distance = Math.hypot(midRow - centerRow, midCol - centerCol);
    const centrality = 1 - Math.min(1, distance / (Math.max(this.rows, this.cols) / 2));

    // 가로/세로 균형 (요구사항 10)
    const acrossCount = this.countByDirection('across');
    const downCount = this.countByDirection('down');
    const balance =
      direction === 'across'
        ? acrossCount <= downCount
          ? 1
          : 0
        : downCount <= acrossCount
          ? 1
          : 0;

    return (
      intersections * weights.intersection +
      centrality * weights.centrality +
      balance * weights.balance -
      (growth / Math.max(1, length)) * weights.boundingGrowth
    );
  }

  private boundsArea(bounds: Bounds): number {
    if (!Number.isFinite(bounds.minRow)) return 0;
    return (bounds.maxRow - bounds.minRow + 1) * (bounds.maxCol - bounds.minCol + 1);
  }

  /** 채워진 칸 수. */
  get filledCells(): number {
    let count = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) if (this.letters[r][c] !== null) count++;
    }
    return count;
  }

  private letterAt(row: number, col: number): string | null {
    if (row < 0 || col < 0 || row >= this.rows || col >= this.cols) return null;
    return this.letters[row][col];
  }

  private addLetterIndex(letter: string, row: number, col: number): void {
    const list = this.letterIndex.get(letter);
    if (list) list.push({ row, col });
    else this.letterIndex.set(letter, [{ row, col }]);
  }
}

function createMatrix<T>(rows: number, cols: number, fill: T): T[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
}
