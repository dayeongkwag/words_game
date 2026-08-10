import { getPuzzleConfig } from '@/config';
import type {
  Direction,
  Puzzle,
  PuzzleCell,
  PuzzleDifficulty,
  PuzzleMetadata,
  WordCategory,
  WordDifficulty,
  WordPlacement,
} from '@/types';
import { hashString } from '@/utils/random';

/**
 * 배치 목록 → 완성된 Puzzle 자료구조.
 *
 * 퍼즐 생성기와 공유 링크 복원(스냅샷) 양쪽에서 같은 함수를 사용하므로,
 * 어떤 경로로 만들어진 퍼즐이든 번호 부여·격자 구성이 완전히 동일하다.
 */

export interface RawPlacement {
  wordId: string;
  /** 정규화된 정답 단어. */
  word: string;
  direction: Direction;
  row: number;
  col: number;
  clue: string;
  difficulty: WordDifficulty;
  category: WordCategory;
}

export interface AssembleInput {
  seed: string;
  placements: readonly RawPlacement[];
  metadata: PuzzleMetadata;
}

export function assemblePuzzle(input: AssembleInput): Puzzle {
  const { seed, placements, metadata } = input;
  if (placements.length === 0) throw new Error('퍼즐에 단어가 하나도 없습니다.');

  // ── 좌표 정규화: 바운딩 박스를 (0,0) 기준으로 옮긴다 ────────────
  let minRow = Infinity;
  let minCol = Infinity;
  let maxRow = -Infinity;
  let maxCol = -Infinity;

  for (const p of placements) {
    const length = Array.from(p.word).length;
    const endRow = p.row + (p.direction === 'down' ? length - 1 : 0);
    const endCol = p.col + (p.direction === 'across' ? length - 1 : 0);
    minRow = Math.min(minRow, p.row);
    minCol = Math.min(minCol, p.col);
    maxRow = Math.max(maxRow, endRow);
    maxCol = Math.max(maxCol, endCol);
  }

  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;

  const shifted = placements.map((p) => ({
    ...p,
    row: p.row - minRow,
    col: p.col - minCol,
    length: Array.from(p.word).length,
  }));

  // ── 문제 번호 부여: 왼쪽 위 → 오른쪽 아래 순 ───────────────────
  const startsAt = new Map<string, typeof shifted>();
  for (const p of shifted) {
    const key = `${p.row},${p.col}`;
    const list = startsAt.get(key);
    if (list) list.push(p);
    else startsAt.set(key, [p]);
  }

  const numbers = new Map<(typeof shifted)[number], number>();
  let nextNumber = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const starting = startsAt.get(`${r},${c}`);
      if (!starting) continue;
      const number = nextNumber++;
      for (const p of starting) numbers.set(p, number);
    }
  }

  // 번호 순 → 같은 번호면 가로 먼저. UI 문제 목록 순서와 일치한다.
  const ordered = shifted.slice().sort((a, b) => {
    const byNumber = (numbers.get(a) ?? 0) - (numbers.get(b) ?? 0);
    if (byNumber !== 0) return byNumber;
    return a.direction === b.direction ? 0 : a.direction === 'across' ? -1 : 1;
  });

  const words: WordPlacement[] = ordered.map((p) => ({
    number: numbers.get(p) ?? 0,
    wordId: p.wordId,
    word: p.word,
    direction: p.direction,
    startRow: p.row,
    startCol: p.col,
    length: p.length,
    clue: p.clue,
    difficulty: p.difficulty,
    category: p.category,
  }));

  // ── 격자 구성 ──────────────────────────────────────────────────
  const grid: (string | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  );
  const cells: (PuzzleCell | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  );

  words.forEach((placement, index) => {
    const dRow = placement.direction === 'down' ? 1 : 0;
    const dCol = placement.direction === 'across' ? 1 : 0;
    Array.from(placement.word).forEach((letter, i) => {
      const r = placement.startRow + dRow * i;
      const c = placement.startCol + dCol * i;
      grid[r][c] = letter;
      let cell = cells[r][c];
      if (!cell) {
        cell = { row: r, col: c, answer: letter, acrossIndex: null, downIndex: null, number: null };
        cells[r][c] = cell;
      }
      if (placement.direction === 'across') cell.acrossIndex = index;
      else cell.downIndex = index;
      if (i === 0) cell.number = placement.number;
    });
  });

  return {
    puzzleId: seed,
    seed,
    rows,
    cols,
    words,
    grid,
    cells,
    difficulty: evaluateDifficulty(words.map((w) => w.difficulty)),
    checksum: computeChecksum(words, rows, cols),
    metadata,
  };
}

/** 퍼즐 난이도 평가. (요구사항 11) */
export function evaluateDifficulty(difficulties: readonly WordDifficulty[]): PuzzleDifficulty {
  const config = getPuzzleConfig();
  if (difficulties.length === 0) return { score: 1, label: '쉬움' };
  const score = difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length;
  const label =
    score < config.difficulty.easyBelow
      ? '쉬움'
      : score >= config.difficulty.hardAtOrAbove
        ? '어려움'
        : '보통';
  return { score: Math.round(score * 100) / 100, label };
}

/**
 * 퍼즐 재현 확인용 체크섬.
 * 공유 링크에 담아 두었다가, 링크를 열었을 때 같은 퍼즐이 나왔는지 대조한다.
 */
export function computeChecksum(
  words: readonly WordPlacement[],
  rows: number,
  cols: number,
): string {
  const canonical = words
    .map((w) => `${w.wordId}|${w.direction}|${w.startRow}|${w.startCol}`)
    .sort()
    .join(';');
  return hashString(`${rows}x${cols}:${canonical}`).toString(36);
}
