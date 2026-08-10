import { beforeEach, describe, expect, it } from 'vitest';
import { getGameConfig, resetGameConfig, resetPuzzleConfig, resetScoringConfig } from '@/config';
import { MockWordRepository } from '@/data/repositories';
import type { GameState, Puzzle, WordPlacement } from '@/types';
import { toSyllables } from '@/utils/hangul';
import { createInitialState, gameReducer, getSolvedCount, toGameResult } from './gameState';
import { cellAt } from './hintSystem';
import { assemblePuzzle } from './puzzleAssembly';
import { generatePuzzle } from './puzzleGenerator';

/**
 * 게임 진행 테스트. (요구사항 56)
 *  - 정답 처리 / 오답 1~5회 / 6번째 오답 게임 종료
 *  - 힌트 최대 3회, 첫 힌트 무료, 2·3번째 점수 차감
 *  - 게임 완료 / 게임 오버
 */

const repository = new MockWordRepository();

async function setup(seed = 'game-test') {
  const puzzle = await generatePuzzle({ seed, repository });
  return { puzzle, state: createInitialState(puzzle, 0) };
}

/** 특정 단어에 문자열을 입력한다. */
function typeWord(
  state: GameState,
  puzzle: Puzzle,
  wordIndex: number,
  text: string,
): GameState {
  const placement = puzzle.words[wordIndex];
  let next = gameReducer(state, { type: 'SELECT_WORD', wordIndex }, { puzzle });
  toSyllables(text).forEach((char, offset) => {
    const { row, col } = cellAt(placement, offset);
    next = gameReducer(next, { type: 'SELECT_CELL', row, col }, { puzzle });
    // SELECT_CELL 이 방향을 바꿀 수 있으므로 단어 방향을 다시 맞춘다.
    next = gameReducer(next, { type: 'SET_DIRECTION', direction: placement.direction }, { puzzle });
    next = gameReducer(next, { type: 'INPUT_CHAR', char }, { puzzle });
  });
  return next;
}

/** 정답과 다른 글자를 만든다. */
function wrongTextFor(placement: WordPlacement): string {
  const letters = toSyllables(placement.word);
  const replacement = letters[0] === '가' ? '나' : '가';
  return [replacement, ...letters.slice(1)].join('');
}

/**
 * 오답 규칙 검증용 고정 퍼즐.
 *
 *   학 교
 *   문
 *
 * 생성 퍼즐은 단어 데이터가 바뀌면 모양이 달라지므로,
 * 규칙 자체를 검증하는 테스트는 이 고정 퍼즐로 결정론적으로 수행한다.
 * '학교'를 채워도 '학문'은 (1,0)이 비어 있어 완성되지 않는다.
 */
function makeFixedPuzzle(): Puzzle {
  return assemblePuzzle({
    seed: 'fixture',
    placements: [
      {
        wordId: 'fx-1',
        word: '학교',
        direction: 'across',
        row: 0,
        col: 0,
        clue: '학생을 가르치는 기관',
        difficulty: 1,
        category: '사회',
      },
      {
        wordId: 'fx-2',
        word: '학문',
        direction: 'down',
        row: 0,
        col: 0,
        clue: '체계적으로 배우고 연구하는 지식',
        difficulty: 2,
        category: '교양/상식',
      },
    ],
    metadata: {
      generatorVersion: 'test',
      dictVersion: 'test',
      attempts: 0,
      shapeScore: 0,
      acrossCount: 1,
      downCount: 1,
      intersectionCount: 1,
      density: 1,
      isFallback: false,
    },
  });
}

describe('gameReducer — 정답 처리', () => {
  beforeEach(() => {
    resetGameConfig();
    resetPuzzleConfig();
    resetScoringConfig();
  });

  it('단어를 정확히 입력하면 정답 처리되고 칸이 잠긴다', async () => {
    const { puzzle, state } = await setup();
    const placement = puzzle.words[0];
    const next = typeWord(state, puzzle, 0, placement.word);

    expect(next.wordProgress[0].solved).toBe(true);
    expect(next.mistakes).toBe(0);
    expect(next.score).toBeGreaterThan(0);

    const { row, col } = cellAt(placement, 0);
    expect(next.lockedCells[row][col]).toBe(true);
    expect(next.solvedFlash?.wordIndex).toBe(0);
  });

  it('모든 단어를 맞히면 COMPLETED 가 된다', async () => {
    const { puzzle, state } = await setup();
    let current = state;
    puzzle.words.forEach((placement, index) => {
      current = typeWord(current, puzzle, index, placement.word);
    });

    expect(getSolvedCount(current)).toBe(puzzle.words.length);
    expect(current.status).toBe('COMPLETED');
    expect(current.finishedAt).not.toBeNull();
  });

  it('완료 후에는 추가 입력이 무시된다', async () => {
    const { puzzle, state } = await setup();
    let current = state;
    puzzle.words.forEach((placement, index) => {
      current = typeWord(current, puzzle, index, placement.word);
    });
    const after = gameReducer(current, { type: 'INPUT_CHAR', char: '가' }, { puzzle });
    expect(after).toBe(current);
  });
});

describe('gameReducer — 오답과 게임 오버 (요구사항 28)', () => {
  beforeEach(() => {
    resetGameConfig();
    resetPuzzleConfig();
    resetScoringConfig();
  });

  it('틀린 단어를 입력하면 오답이 1 증가하고 흔들림이 트리거된다', async () => {
    const { puzzle, state } = await setup();
    const next = typeWord(state, puzzle, 0, wrongTextFor(puzzle.words[0]));

    expect(next.mistakes).toBe(1);
    expect(next.wordProgress[0].solved).toBe(false);
    expect(next.shake?.wordIndex).toBe(0);
  });

  it('같은 오답 입력을 다시 확인해도 오답이 중복 집계되지 않는다', async () => {
    const { puzzle, state } = await setup();
    const wrong = typeWord(state, puzzle, 0, wrongTextFor(puzzle.words[0]));
    const again = gameReducer(wrong, { type: 'SUBMIT' }, { puzzle });
    expect(again.mistakes).toBe(1);
  });

  it('1~5번째 오답까지는 계속 플레이할 수 있다', () => {
    const puzzle = makeFixedPuzzle();
    const config = getGameConfig();
    let current = createInitialState(puzzle, 0);

    const fillers = ['나', '다', '라', '마', '바'];
    for (let i = 0; i < config.mistakes.max; i++) {
      current = typeWord(current, puzzle, 0, `${fillers[i]}교`);
      expect(current.mistakes, `${i + 1}번째 오답`).toBe(i + 1);
      expect(current.status, `${i + 1}번째 오답`).toBe('PLAYING');
    }

    expect(current.mistakes).toBe(config.mistakes.max);
  });

  it('6번째 오답이 나오면 즉시 GAME_OVER 가 된다', () => {
    const puzzle = makeFixedPuzzle();
    const config = getGameConfig();
    let current = createInitialState(puzzle, 0);

    const fillers = ['나', '다', '라', '마', '바', '사'];
    for (let i = 0; i <= config.mistakes.max; i++) {
      current = typeWord(current, puzzle, 0, `${fillers[i]}교`);
    }

    expect(current.mistakes).toBe(config.mistakes.max + 1);
    expect(current.status).toBe('GAME_OVER');
    expect(current.finishedAt).not.toBeNull();

    const result = toGameResult(current, puzzle);
    expect(result.status).toBe('GAME_OVER');
    expect(result.maxMistakes).toBe(config.mistakes.max);
  });

  it('작업 중이 아닌 교차 단어는 우연히 채워져도 오답으로 세지 않는다', () => {
    const puzzle = makeFixedPuzzle();
    let current = createInitialState(puzzle, 0);

    // 먼저 세로 '학문'의 두 번째 칸에 틀린 글자를 넣어 둔다. (아직 미완성)
    current = typeWord(current, puzzle, 1, '학수');
    expect(current.mistakes).toBe(1); // '학수' 자체는 작업 중이었으므로 오답 1회

    // 이제 가로 '학교'를 정답으로 채운다.
    // (0,0)이 채워지며 세로 '학문'도 '학수'로 완성되지만, 작업 중인 단어가 아니므로 오답 아님.
    const before = current.mistakes;
    current = typeWord(current, puzzle, 0, '학교');

    expect(current.wordProgress[0].solved).toBe(true);
    expect(current.mistakes).toBe(before);
  });

  it('교차 단어가 우연히 정답으로 완성되면 정답 처리된다', () => {
    const puzzle = makeFixedPuzzle();
    let current = createInitialState(puzzle, 0);

    // 세로 '학문'의 아래 칸만 먼저 채운다.
    current = gameReducer(current, { type: 'SELECT_WORD', wordIndex: 1 }, { puzzle });
    current = gameReducer(current, { type: 'SELECT_CELL', row: 1, col: 0 }, { puzzle });
    current = gameReducer(current, { type: 'INPUT_CHAR', char: '문' }, { puzzle });
    expect(current.wordProgress[1].solved).toBe(false);

    // 가로 '학교'를 채우면 (0,0)의 '학'으로 세로 '학문'도 완성된다.
    current = typeWord(current, puzzle, 0, '학교');

    expect(current.wordProgress[0].solved).toBe(true);
    expect(current.wordProgress[1].solved).toBe(true);
    expect(current.mistakes).toBe(0);
    expect(current.status).toBe('COMPLETED');
  });
});

describe('gameReducer — 커서와 방향 (요구사항 21·43)', () => {
  beforeEach(() => resetGameConfig());

  it('교차 칸을 다시 누르면 가로↔세로가 전환된다', async () => {
    const { puzzle, state } = await setup();
    // 가로·세로 단어가 모두 지나는 칸을 찾는다.
    let target: { row: number; col: number } | null = null;
    for (let r = 0; r < puzzle.rows && !target; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const cell = puzzle.cells[r][c];
        if (cell && cell.acrossIndex !== null && cell.downIndex !== null) {
          target = { row: r, col: c };
          break;
        }
      }
    }
    expect(target).not.toBeNull();

    const first = gameReducer(state, { type: 'SELECT_CELL', ...target! }, { puzzle });
    const second = gameReducer(first, { type: 'SELECT_CELL', ...target! }, { puzzle });
    expect(second.cursor.direction).not.toBe(first.cursor.direction);
    expect(second.selectedWordIndex).not.toBe(first.selectedWordIndex);
  });

  it('백스페이스로 입력한 글자를 지울 수 있다', async () => {
    const { puzzle, state } = await setup();
    const placement = puzzle.words[0];
    const { row, col } = cellAt(placement, 0);

    let current = gameReducer(state, { type: 'SELECT_WORD', wordIndex: 0 }, { puzzle });
    current = gameReducer(current, { type: 'INPUT_CHAR', char: '가' }, { puzzle });
    expect(current.userGrid[row][col]).toBe('가');

    current = gameReducer(current, { type: 'SELECT_CELL', row, col }, { puzzle });
    current = gameReducer(current, { type: 'BACKSPACE' }, { puzzle });
    expect(current.userGrid[row][col]).toBe('');
  });
});

describe('gameReducer — 일시정지', () => {
  it('PAUSED 상태에서는 입력이 무시되고 RESUME 으로 복귀한다', async () => {
    const { puzzle, state } = await setup();
    const paused = gameReducer(state, { type: 'PAUSE' }, { puzzle });
    expect(paused.status).toBe('PAUSED');

    const ignored = gameReducer(paused, { type: 'INPUT_CHAR', char: '가' }, { puzzle });
    expect(ignored).toBe(paused);

    const resumed = gameReducer(paused, { type: 'RESUME' }, { puzzle });
    expect(resumed.status).toBe('PLAYING');
  });
});
