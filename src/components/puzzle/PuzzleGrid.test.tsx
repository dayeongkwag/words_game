import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/game/gameState';
import { assemblePuzzle } from '@/game/puzzleAssembly';
import { toPuzzleView } from '@/game/puzzleView';
import type { Puzzle } from '@/types';
import { PuzzleGrid } from './PuzzleGrid';

/**
 * 격자 배치 회귀 테스트.
 *
 * 실제로 났던 버그: 숨은 input 이 위치를 명시하고 있어서, CSS Grid 자동 배치가
 * 커서 칸부터 뒤의 모든 칸을 한 칸씩 밀어 버렸다.
 * → 모든 칸이 자기 좌표를 명시적으로 갖고 있는지 확인한다.
 */

/**
 *   학 교
 *   문
 *   자 연 (가로)
 */
function makePuzzle(): Puzzle {
  return assemblePuzzle({
    seed: 'grid-fixture',
    placements: [
      {
        wordId: 'w1',
        word: '학교',
        direction: 'across',
        row: 0,
        col: 0,
        clue: '학생을 가르치는 기관',
        difficulty: 1,
        category: '사회',
      },
      {
        wordId: 'w2',
        word: '학문자',
        direction: 'down',
        row: 0,
        col: 0,
        clue: '테스트용 세로 단어',
        difficulty: 1,
        category: '기타',
      },
      {
        wordId: 'w3',
        word: '자연',
        direction: 'across',
        row: 2,
        col: 0,
        clue: '사람의 손이 닿지 않은 본래의 세계',
        difficulty: 1,
        category: '자연',
      },
    ],
    metadata: {
      generatorVersion: 'test',
      dictVersion: 'test',
      attempts: 0,
      shapeScore: 0,
      acrossCount: 2,
      downCount: 1,
      intersectionCount: 2,
      density: 1,
      isFallback: false,
    },
  });
}

const noop = () => {};

function render(selectedWordIndex: number | null = 0) {
  const puzzle = makePuzzle();
  const view = toPuzzleView(puzzle);
  const base = createInitialState(puzzle, 0);
  const state = { ...base, selectedWordIndex };

  const html = renderToStaticMarkup(
    <PuzzleGrid
      view={view}
      state={state}
      onSelectCell={noop}
      onChar={noop}
      onBackspace={noop}
      onMove={noop}
      onToggleDirection={noop}
      onSubmit={noop}
    />,
  );
  return { puzzle, view, html };
}

/** 렌더된 HTML 에서 각 요소의 grid 좌표를 뽑는다. */
function extractPositions(html: string): { row: number; col: number; blocked: boolean }[] {
  const cells: { row: number; col: number; blocked: boolean }[] = [];
  const pattern = /<(?:div|button)[^>]*class="([^"]*\bcell\b[^"]*)"[^>]*style="([^"]*)"/g;
  for (const match of html.matchAll(pattern)) {
    const [, className, style] = match;
    const row = Number(/grid-row:\s*(\d+)/.exec(style)?.[1]);
    const col = Number(/grid-column:\s*(\d+)/.exec(style)?.[1]);
    cells.push({ row, col, blocked: className.includes('cell--block') });
  }
  return cells;
}

describe('PuzzleGrid 배치', () => {
  it('모든 칸이 자기 좌표를 명시적으로 지정한다', () => {
    const { view, html } = render();
    const cells = extractPositions(html);

    // 빈 칸을 포함해 격자 전체가 렌더링되어야 한다.
    expect(cells).toHaveLength(view.rows * view.cols);

    for (const cell of cells) {
      expect(Number.isFinite(cell.row), 'grid-row 누락').toBe(true);
      expect(Number.isFinite(cell.col), 'grid-column 누락').toBe(true);
    }
  });

  it('각 좌표에 칸이 정확히 하나씩 있다 (밀림 없음)', () => {
    const { view, html } = render();
    const seen = new Set<string>();

    for (const cell of extractPositions(html)) {
      const key = `${cell.row},${cell.col}`;
      expect(seen.has(key), `좌표 중복: ${key}`).toBe(false);
      seen.add(key);
      expect(cell.row).toBeGreaterThanOrEqual(1);
      expect(cell.row).toBeLessThanOrEqual(view.rows);
      expect(cell.col).toBeGreaterThanOrEqual(1);
      expect(cell.col).toBeLessThanOrEqual(view.cols);
    }
  });

  it('막힌 칸과 사용하는 칸이 뷰와 정확히 일치한다', () => {
    const { view, html } = render();

    for (const cell of extractPositions(html)) {
      // grid 좌표는 1부터 시작한다.
      expect(cell.blocked).toBe(view.blocked[cell.row - 1][cell.col - 1]);
    }
  });

  it('선택한 단어의 칸 수만큼만 강조된다 (앞뒤 칸 침범 없음)', () => {
    const { view, html } = render(0);
    const clue = view.clues[0];

    const highlighted = [...html.matchAll(/class="([^"]*cell--in-word[^"]*)"[^>]*style="([^"]*)"/g)]
      .map(([, , style]) => ({
        row: Number(/grid-row:\s*(\d+)/.exec(style)?.[1]) - 1,
        col: Number(/grid-column:\s*(\d+)/.exec(style)?.[1]) - 1,
      }))
      .sort((a, b) => a.row - b.row || a.col - b.col);

    const expected = Array.from({ length: clue.length }, (_, i) => ({
      row: clue.startRow + (clue.direction === 'down' ? i : 0),
      col: clue.startCol + (clue.direction === 'across' ? i : 0),
    }));

    expect(highlighted).toEqual(expected);
  });

  it('선택된 단어가 없으면 강조되는 칸도 없다', () => {
    const { html } = render(null);
    expect(html).not.toContain('cell--in-word');
  });

  it('누른 칸만 따로 진하게 표시하지 않는다', () => {
    const { view, html } = render(0);

    // 커서 칸을 위한 별도 스타일 클래스가 붙지 않아야 한다.
    expect(html).not.toContain('cell--cursor');

    // 선택된 낱말의 칸들은 클래스 구성이 서로 완전히 같아야 한다.
    const classes = [...html.matchAll(/class="([^"]*cell--in-word[^"]*)"/g)].map(([, c]) =>
      c.split(/\s+/).sort().join(' '),
    );
    expect(classes).toHaveLength(view.clues[0].length);
    expect(new Set(classes).size).toBe(1);
  });

  it('입력창 자리가 현재 커서 칸의 격자 좌표를 지정한다', () => {
    const { puzzle, html } = render(0);
    const cursor = { row: puzzle.words[0].startRow, col: puzzle.words[0].startCol };

    // 좌표는 입력창을 감싸는 자리 div 가 갖는다. (크기 계산을 div 에 맡겼기 때문)
    const slot = /<div[^>]*class="grid__input-slot"[^>]*>/.exec(html)?.[0] ?? '';
    expect(slot, '입력창 자리가 렌더링되지 않았다').not.toBe('');

    const style = /style="([^"]*)"/.exec(slot)?.[1] ?? '';
    expect(Number(/grid-row:\s*(\d+)/.exec(style)?.[1])).toBe(cursor.row + 1);
    expect(Number(/grid-column:\s*(\d+)/.exec(style)?.[1])).toBe(cursor.col + 1);

    // 입력창은 그 안에 있어야 한다.
    expect(html).toContain('class="grid__input-slot"');
    expect(html).toMatch(/class="grid__input-slot"[^>]*>\s*<input/);
  });

  it('정답 글자를 마크업에 노출하지 않는다', () => {
    const { puzzle, html } = render();
    for (const word of puzzle.words) {
      expect(html).not.toContain(word.word);
    }
  });
});
