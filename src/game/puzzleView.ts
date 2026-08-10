import type { ClueView, Puzzle, PuzzleView } from '@/types';

/**
 * 정답이 제거된 퍼즐 뷰를 만든다. (요구사항 53)
 *
 * UI 컴포넌트는 이 객체만 받으므로, React DevTools 나 props 를 들여다봐도
 * 정답 글자가 드러나지 않는다. 정답 비교는 게임 엔진(gameState)에서만 수행한다.
 */
export function toPuzzleView(puzzle: Puzzle): PuzzleView {
  const blocked: boolean[][] = [];
  const numbers: (number | null)[][] = [];
  const cellWords: ({ across: number | null; down: number | null } | null)[][] = [];

  for (let r = 0; r < puzzle.rows; r++) {
    const blockedRow: boolean[] = [];
    const numberRow: (number | null)[] = [];
    const wordRow: ({ across: number | null; down: number | null } | null)[] = [];
    for (let c = 0; c < puzzle.cols; c++) {
      const cell = puzzle.cells[r][c];
      blockedRow.push(cell === null);
      numberRow.push(cell?.number ?? null);
      wordRow.push(cell ? { across: cell.acrossIndex, down: cell.downIndex } : null);
    }
    blocked.push(blockedRow);
    numbers.push(numberRow);
    cellWords.push(wordRow);
  }

  const clues: ClueView[] = puzzle.words.map((word, index) => ({
    index,
    number: word.number,
    direction: word.direction,
    clue: word.clue,
    length: word.length,
    startRow: word.startRow,
    startCol: word.startCol,
    difficulty: word.difficulty,
  }));

  return {
    puzzleId: puzzle.puzzleId,
    rows: puzzle.rows,
    cols: puzzle.cols,
    blocked,
    numbers,
    cellWords,
    clues,
    difficulty: puzzle.difficulty,
  };
}

/** 가로/세로로 나눈 문제 목록. 힌트 패널 렌더링에 사용. */
export function splitClues(view: PuzzleView): { across: ClueView[]; down: ClueView[] } {
  return {
    across: view.clues.filter((c) => c.direction === 'across'),
    down: view.clues.filter((c) => c.direction === 'down'),
  };
}
