/**
 * 점수 계산에 사용되는 모든 계수.
 * 실제 계산 로직은 `src/game/scoring.ts` 에 있으며, UI 는 점수를 계산하지 않는다.
 */
export interface ScoringConfig {
  /** 단어 하나를 맞혔을 때의 기본 점수. */
  baseWordScore: number;
  /** 글자 수 보너스: (length - lengthBonusFrom) * lengthBonusPerChar */
  lengthBonusFrom: number;
  lengthBonusPerChar: number;
  /** 난이도(1~5)별 배수. */
  difficultyMultiplier: Record<1 | 2 | 3 | 4 | 5, number>;
  /** 힌트로 공개된 단어에 적용되는 배수(정답 점수 축소). */
  hintRevealedMultiplier: number;
  /** 오답 1회당 차감 점수. */
  mistakePenalty: number;

  completion: {
    /** 퍼즐을 모두 완성했을 때의 보너스. */
    bonus: number;
    /** 오답 0회 클리어 보너스. */
    perfectBonus: number;
    /** 힌트 0회 클리어 보너스. */
    noHintBonus: number;
  };

  time: {
    /**
     * 시간 보너스 = max(0, (targetSeconds - 소요초)) * bonusPerSecond
     * 단어 1개당 targetSecondsPerWord 초를 기준 시간으로 잡는다.
     */
    targetSecondsPerWord: number;
    bonusPerSecond: number;
    /** 시간 보너스 상한. */
    maxBonus: number;
  };

  /** 최종 점수 하한. */
  minScore: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  baseWordScore: 100,
  lengthBonusFrom: 2,
  lengthBonusPerChar: 20,
  difficultyMultiplier: { 1: 0.8, 2: 1.0, 3: 1.2, 4: 1.45, 5: 1.7 },
  hintRevealedMultiplier: 0.4,
  mistakePenalty: 40,
  completion: {
    bonus: 300,
    perfectBonus: 200,
    noHintBonus: 150,
  },
  time: {
    targetSecondsPerWord: 25,
    bonusPerSecond: 2,
    maxBonus: 400,
  },
  minScore: 0,
};

let current: ScoringConfig = DEFAULT_SCORING_CONFIG;

export function getScoringConfig(): ScoringConfig {
  return current;
}

export function applyScoringConfigOverrides(overrides: Partial<ScoringConfig>): ScoringConfig {
  current = {
    ...current,
    ...overrides,
    difficultyMultiplier: {
      ...current.difficultyMultiplier,
      ...overrides.difficultyMultiplier,
    },
    completion: { ...current.completion, ...overrides.completion },
    time: { ...current.time, ...overrides.time },
  };
  return current;
}

export function resetScoringConfig(): void {
  current = DEFAULT_SCORING_CONFIG;
}
