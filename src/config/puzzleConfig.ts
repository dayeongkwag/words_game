/**
 * 퍼즐 생성기 튜닝 값.
 * 알고리즘 자체는 `src/game/puzzleGenerator.ts` 에 있고, 여기에는 수치만 둔다.
 *
 * 주의: 이 값을 바꾸면 같은 seed 라도 다른 퍼즐이 생성될 수 있다.
 * 그래서 `GENERATOR_VERSION` 을 함께 두고 공유 링크에 기록한다.
 */

/** 알고리즘 또는 튜닝 값이 바뀌면 반드시 올린다. */
export const GENERATOR_VERSION = '1';

export interface PuzzleConfig {
  /** 격자 최대 크기(칸). 모바일 가독성을 위해 과도하게 크지 않게 유지한다. */
  grid: {
    maxRows: number;
    maxCols: number;
    /** 후보 배치를 시도할 때 사용하는 작업 격자 크기(최종 결과는 잘라낸다). */
    workRows: number;
    workCols: number;
  };

  /** 한 퍼즐을 만들 때 생성해 볼 후보 개수와 재시도 한계. (요구사항 55) */
  attempts: {
    /** 생성할 후보 퍼즐 개수. 이 중 모양 점수가 가장 높은 것을 고른다. */
    candidates: number;
    /** 후보 하나를 만들 때 단어 조합을 바꿔 재시도할 최대 횟수. */
    maxRetriesPerCandidate: number;
    /** 전체 생성 시도 상한(무한 루프 방지). */
    hardLimit: number;
    /** 품질 기준을 통과한 후보가 이만큼 모이면 조기 종료한다. */
    enoughStrictResults: number;
  };

  /** 후보 단어 선택 규칙. */
  selection: {
    /** 후보 풀 크기(목표 단어 수의 배수). */
    poolMultiplier: number;
    /** 후보 풀 최소 크기. */
    poolMin: number;
    /** 사용할 단어 길이 범위. */
    minWordLength: number;
    maxWordLength: number;
    /** 첫 단어(씨앗)로 쓸 최소 길이. */
    seedWordMinLength: number;
  };

  /** 배치 규칙. */
  placement: {
    /**
     * 상위 N개의 배치 후보 중에서 무작위로 하나를 고른다.
     * 1이면 항상 최선을 고르므로 퍼즐 모양이 단조로워진다.
     */
    topCandidates: number;
    /** 한 단계에서 배치를 시도해 볼 후보 단어 수(성능 상한). */
    wordsPerStep: number;
    /** 배치 점수 가중치. */
    weights: {
      /** 교차 개수 보너스. */
      intersection: number;
      /** 격자 중심에 가까울수록 보너스. */
      centrality: number;
      /** 바운딩 박스가 커지는 것에 대한 페널티. */
      boundingGrowth: number;
      /** 가로/세로 균형 보너스. */
      balance: number;
    };
  };

  /** 완성된 퍼즐의 품질 평가/합격 기준. (요구사항 10) */
  quality: {
    /** 최소 교차 비율 = 교차점 / 단어 수. */
    minIntersectionRatio: number;
    /** 가로 또는 세로가 차지할 수 있는 최대 비율. (한쪽으로 몰림 방지) */
    maxDirectionRatio: number;
    /** 바운딩 박스 가로:세로 비율 허용 최대치. (지나치게 긴 형태 방지) */
    maxAspectRatio: number;
    /** 최소 채움 밀도(채운 칸 / 바운딩 박스 칸). 너무 성긴 퍼즐 방지. */
    minDensity: number;
    /** 모양 점수 가중치. */
    weights: {
      wordCount: number;
      intersectionRatio: number;
      balance: number;
      compactness: number;
      aspect: number;
      density: number;
    };
  };

  /** 난이도 조절. (요구사항 11) */
  difficulty: {
    /** 게임마다 뽑는 목표 평균 난이도의 범위. */
    targetMin: number;
    targetMax: number;
    /** 체감 난이도 라벨 경계값. */
    easyBelow: number;
    hardAtOrAbove: number;
  };
}

export const DEFAULT_PUZZLE_CONFIG: PuzzleConfig = {
  grid: {
    maxRows: 15,
    maxCols: 15,
    workRows: 21,
    workCols: 21,
  },
  attempts: {
    candidates: 10,
    maxRetriesPerCandidate: 3,
    hardLimit: 40,
    enoughStrictResults: 5,
  },
  selection: {
    poolMultiplier: 8,
    poolMin: 60,
    minWordLength: 2,
    maxWordLength: 6,
    seedWordMinLength: 3,
  },
  placement: {
    topCandidates: 3,
    wordsPerStep: 45,
    weights: {
      intersection: 12,
      centrality: 3,
      boundingGrowth: 2.5,
      balance: 4,
    },
  },
  quality: {
    minIntersectionRatio: 0.7,
    maxDirectionRatio: 0.75,
    maxAspectRatio: 2.0,
    minDensity: 0.22,
    weights: {
      wordCount: 6,
      intersectionRatio: 30,
      balance: 25,
      compactness: 12,
      aspect: 18,
      density: 14,
    },
  },
  difficulty: {
    targetMin: 1.6,
    targetMax: 3.6,
    easyBelow: 2.1,
    hardAtOrAbove: 3.0,
  },
};

let current: PuzzleConfig = DEFAULT_PUZZLE_CONFIG;

export function getPuzzleConfig(): PuzzleConfig {
  return current;
}

export function resetPuzzleConfig(): void {
  current = DEFAULT_PUZZLE_CONFIG;
}
