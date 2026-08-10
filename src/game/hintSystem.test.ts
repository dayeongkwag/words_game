import { beforeEach, describe, expect, it } from 'vitest';
import { getGameConfig, resetGameConfig, resetPuzzleConfig, resetScoringConfig } from '@/config';
import { MockWordRepository } from '@/data/repositories';
import { getInitials, toSyllables } from '@/utils/hangul';
import { createInitialState, gameReducer } from './gameState';
import { cellAt, getHintAvailability, hintCost } from './hintSystem';
import { generatePuzzle } from './puzzleGenerator';

/**
 * 힌트 테스트. (요구사항 23·24·25·56)
 *  - 최대 3회
 *  - 첫 힌트 무료
 *  - 2·3번째 힌트 점수 차감 (3번째가 더 큼)
 */

const repository = new MockWordRepository();

async function setup(seed = 'hint-test') {
  const puzzle = await generatePuzzle({ seed, repository });
  return { puzzle, state: createInitialState(puzzle, 0) };
}

describe('hintCost', () => {
  beforeEach(() => resetGameConfig());

  it('첫 번째 힌트는 무료다', () => {
    expect(hintCost('revealLetter', 0)).toBe(0);
    expect(hintCost('revealInitials', 0)).toBe(0);
    expect(hintCost('revealWord', 0)).toBe(0);
  });

  it('두 번째 힌트는 설정된 기본 차감 점수가 그대로 적용된다', () => {
    const config = getGameConfig();
    expect(hintCost('revealLetter', 1)).toBe(config.hints.baseCost.revealLetter);
    expect(hintCost('revealInitials', 1)).toBe(config.hints.baseCost.revealInitials);
    expect(hintCost('revealWord', 1)).toBe(config.hints.baseCost.revealWord);
  });

  it('세 번째 힌트는 두 번째보다 더 크게 차감된다', () => {
    for (const type of ['revealLetter', 'revealInitials', 'revealWord'] as const) {
      expect(hintCost(type, 2)).toBeGreaterThan(hintCost(type, 1));
    }
  });

  it('차감 점수는 설정 파일에서만 결정된다 (하드코딩 금지 확인)', () => {
    const config = getGameConfig();
    expect(hintCost('revealWord', 1)).toBe(
      Math.round(config.hints.baseCost.revealWord * config.hints.costMultiplierByOrder[1]),
    );
  });
});

describe('힌트 사용', () => {
  beforeEach(() => {
    resetGameConfig();
    resetPuzzleConfig();
    resetScoringConfig();
  });

  it('한 글자 공개 힌트는 칸 하나를 채우고 잠근다', async () => {
    const { puzzle, state } = await setup();
    const placement = puzzle.words[0];
    let current = gameReducer(state, { type: 'SELECT_WORD', wordIndex: 0 }, { puzzle });
    current = gameReducer(current, { type: 'USE_HINT', hintType: 'revealLetter' }, { puzzle });

    const { row, col } = cellAt(placement, 0);
    expect(current.userGrid[row][col]).toBe(toSyllables(placement.word)[0]);
    expect(current.lockedCells[row][col]).toBe(true);
    expect(current.hintsUsed).toHaveLength(1);
    expect(current.hintsUsed[0].cost).toBe(0);
  });

  it('초성 공개 힌트는 격자를 채우지 않고 초성만 알려 준다', async () => {
    const { puzzle, state } = await setup();
    let current = gameReducer(state, { type: 'SELECT_WORD', wordIndex: 0 }, { puzzle });
    current = gameReducer(current, { type: 'USE_HINT', hintType: 'revealInitials' }, { puzzle });

    expect(current.revealedInitials[0]).toBe(getInitials(puzzle.words[0].word));
    expect(current.wordProgress[0].initialsRevealed).toBe(true);
    expect(current.userGrid.flat().every((cell) => cell === '')).toBe(true);
  });

  it('정답 공개 힌트는 단어를 즉시 정답 처리한다', async () => {
    const { puzzle, state } = await setup();
    let current = gameReducer(state, { type: 'SELECT_WORD', wordIndex: 0 }, { puzzle });
    current = gameReducer(current, { type: 'USE_HINT', hintType: 'revealWord' }, { puzzle });

    expect(current.wordProgress[0].solved).toBe(true);
    expect(current.wordProgress[0].revealedByHint).toBe(true);
    expect(current.mistakes).toBe(0);
  });

  it('힌트는 최대 3회까지만 사용할 수 있다', async () => {
    const { puzzle, state } = await setup();
    const config = getGameConfig();
    let current = state;

    for (let i = 0; i < config.hints.max + 2; i++) {
      const wordIndex = Math.min(i, puzzle.words.length - 1);
      current = gameReducer(current, { type: 'SELECT_WORD', wordIndex }, { puzzle });
      current = gameReducer(current, { type: 'USE_HINT', hintType: 'revealInitials' }, { puzzle });
    }

    expect(current.hintsUsed.length).toBe(config.hints.max);
    expect(getHintAvailability(current, puzzle).remaining).toBe(0);
    expect(getHintAvailability(current, puzzle).canUse).toBe(false);
  });

  it('힌트를 쓸수록 점수가 더 많이 차감된다', async () => {
    const { puzzle, state } = await setup();
    let current = state;
    const costs: number[] = [];

    for (let i = 0; i < 3; i++) {
      current = gameReducer(current, { type: 'SELECT_WORD', wordIndex: i }, { puzzle });
      current = gameReducer(current, { type: 'USE_HINT', hintType: 'revealInitials' }, { puzzle });
      costs.push(current.hintsUsed[i].cost);
    }

    expect(costs[0]).toBe(0);
    expect(costs[1]).toBeGreaterThan(costs[0]);
    expect(costs[2]).toBeGreaterThan(costs[1]);
  });

  it('이미 푼 단어에는 힌트를 쓸 수 없다', async () => {
    const { puzzle, state } = await setup();
    let current = gameReducer(state, { type: 'SELECT_WORD', wordIndex: 0 }, { puzzle });
    current = gameReducer(current, { type: 'USE_HINT', hintType: 'revealWord' }, { puzzle });

    const availability = getHintAvailability(current, puzzle);
    expect(availability.options.every((option) => !option.enabled)).toBe(true);

    const after = gameReducer(current, { type: 'USE_HINT', hintType: 'revealLetter' }, { puzzle });
    expect(after.hintsUsed).toHaveLength(1);
  });
});
