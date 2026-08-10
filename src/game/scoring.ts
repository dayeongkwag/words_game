import { getScoringConfig, type ScoringConfig } from '@/config';
import type { HintUsage, Puzzle, WordPlacement, WordProgress } from '@/types';

/**
 * 점수 계산. (요구사항 30)
 *
 * 점수 로직은 오직 이 모듈에만 존재한다. UI 컴포넌트는 계산하지 않고 결과만 표시한다.
 * 계수는 전부 `scoringConfig.ts` 에서 온다.
 */

export interface ScoreBreakdown {
  /** 맞힌 단어들로 얻은 점수. */
  wordScore: number;
  /** 오답 차감(음수). */
  mistakePenalty: number;
  /** 힌트 차감(음수). */
  hintPenalty: number;
  /** 퍼즐 완료 보너스. */
  completionBonus: number;
  /** 시간 보너스. */
  timeBonus: number;
  /** 최종 점수(하한 적용). */
  total: number;
}

export interface ScoreInput {
  puzzle: Puzzle;
  wordProgress: readonly WordProgress[];
  mistakes: number;
  hintsUsed: readonly HintUsage[];
  elapsedMs: number;
  /** 퍼즐을 모두 완성했는지. 완성 시에만 시간/완주 보너스가 붙는다. */
  completed: boolean;
  config?: ScoringConfig;
}

/** 단어 하나를 맞혔을 때의 점수. */
export function scoreForWord(
  placement: WordPlacement,
  options: { revealedByHint?: boolean; config?: ScoringConfig } = {},
): number {
  const config = options.config ?? getScoringConfig();
  const lengthBonus =
    Math.max(0, placement.length - config.lengthBonusFrom) * config.lengthBonusPerChar;
  const base = (config.baseWordScore + lengthBonus) * config.difficultyMultiplier[placement.difficulty];
  return Math.round(base * (options.revealedByHint ? config.hintRevealedMultiplier : 1));
}

/** 힌트 1건의 차감 점수. */
export function totalHintPenalty(
  hintsUsed: readonly HintUsage[],
): number {
  return hintsUsed.reduce((sum, hint) => sum + hint.cost, 0);
}

/** 현재 상태의 점수를 계산한다. 플레이 중/종료 후 모두 같은 함수를 쓴다. */
export function computeScore(input: ScoreInput): ScoreBreakdown {
  const config = input.config ?? getScoringConfig();

  let wordScore = 0;
  input.puzzle.words.forEach((placement, index) => {
    const progress = input.wordProgress[index];
    if (!progress?.solved) return;
    wordScore += scoreForWord(placement, { revealedByHint: progress.revealedByHint, config });
  });

  const mistakePenalty = -input.mistakes * config.mistakePenalty;
  const hintPenalty = -totalHintPenalty(input.hintsUsed);

  let completionBonus = 0;
  let timeBonus = 0;

  if (input.completed) {
    completionBonus += config.completion.bonus;
    if (input.mistakes === 0) completionBonus += config.completion.perfectBonus;
    if (input.hintsUsed.length === 0) completionBonus += config.completion.noHintBonus;

    const targetSeconds = input.puzzle.words.length * config.time.targetSecondsPerWord;
    const elapsedSeconds = input.elapsedMs / 1000;
    timeBonus = Math.min(
      config.time.maxBonus,
      Math.max(0, Math.round((targetSeconds - elapsedSeconds) * config.time.bonusPerSecond)),
    );
  }

  const total = Math.max(
    config.minScore,
    Math.round(wordScore + mistakePenalty + hintPenalty + completionBonus + timeBonus),
  );

  return { wordScore, mistakePenalty, hintPenalty, completionBonus, timeBonus, total };
}
