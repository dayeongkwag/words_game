import type { HintType } from '@/types';

/**
 * 게임 규칙 설정.
 *
 * 요구사항 58/59에 따라 게임 규칙에 관한 모든 수치는 이 파일 한 곳에서만 정의한다.
 * UI/엔진 코드에 숫자를 직접 쓰지 않는다.
 * 향후 관리자 페이지에서 이 값을 덮어쓸 수 있도록 `applyGameConfigOverrides()` 를 제공한다.
 */
export interface GameConfig {
  /** 한 퍼즐에 들어가는 단어 수 범위. */
  words: {
    min: number;
    max: number;
    /** 매 게임 목표 단어 수를 뽑을 때 사용할 선호 범위. */
    preferredMin: number;
    preferredMax: number;
  };

  mistakes: {
    /** 허용되는 오답 횟수. 이 값을 초과하는 순간(= max+1 번째) 게임 오버. */
    max: number;
  };

  hints: {
    /** 한 게임에서 사용 가능한 최대 힌트 횟수. */
    max: number;
    /** 무료로 제공되는 힌트 횟수(앞에서부터). */
    freeCount: number;
    /**
     * n번째 힌트의 차감 배율.
     * index 0 = 첫 번째 힌트 … 배열 길이는 hints.max 와 같아야 한다.
     * 첫 힌트 무료(0), 두 번째 정상 차감(1.0), 세 번째 더 큰 차감(1.6).
     */
    costMultiplierByOrder: number[];
    /** 힌트 종류별 기본 차감 점수. */
    baseCost: Record<HintType, number>;
    /** 힌트 종류별 UI 라벨. */
    label: Record<HintType, string>;
    /** 힌트 종류별 설명. */
    description: Record<HintType, string>;
  };

  timer: {
    /** 타이머 갱신 주기(ms). */
    tickMs: number;
    /** 제한 시간(ms). null 이면 무제한. */
    limitMs: number | null;
  };

  records: {
    /** 로컬에 보관할 최근 기록 개수. */
    keep: number;
    /** 기록 화면에 보여줄 개수. */
    display: number;
  };
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  words: {
    min: 7,
    max: 20,
    preferredMin: 9,
    preferredMax: 16,
  },

  mistakes: {
    max: 5,
  },

  hints: {
    max: 3,
    freeCount: 1,
    costMultiplierByOrder: [0, 1, 1.6],
    baseCost: {
      revealLetter: 30,
      revealInitials: 50,
      revealWord: 70,
    },
    label: {
      revealLetter: '한 글자 공개',
      revealInitials: '초성 공개',
      revealWord: '정답 공개',
    },
    description: {
      revealLetter: '선택한 칸의 글자 하나를 공개합니다.',
      revealInitials: '단어 전체의 초성을 공개합니다.',
      revealWord: '이 단어의 정답을 모두 공개합니다.',
    },
  },

  timer: {
    tickMs: 250,
    limitMs: null,
  },

  records: {
    keep: 50,
    display: 5,
  },
};

let current: GameConfig = DEFAULT_GAME_CONFIG;

/** 현재 적용 중인 게임 설정. */
export function getGameConfig(): GameConfig {
  return current;
}

/**
 * 설정 일부를 덮어쓴다. (향후 관리자 페이지 연동 지점)
 * 얕은 병합이 아니라 섹션 단위 병합을 수행한다.
 */
export function applyGameConfigOverrides(overrides: DeepPartial<GameConfig>): GameConfig {
  current = {
    words: { ...current.words, ...overrides.words },
    mistakes: { ...current.mistakes, ...overrides.mistakes },
    hints: {
      ...current.hints,
      ...overrides.hints,
      baseCost: { ...current.hints.baseCost, ...overrides.hints?.baseCost },
      label: { ...current.hints.label, ...overrides.hints?.label },
      description: { ...current.hints.description, ...overrides.hints?.description },
      costMultiplierByOrder:
        overrides.hints?.costMultiplierByOrder ?? current.hints.costMultiplierByOrder,
    },
    timer: { ...current.timer, ...overrides.timer },
    records: { ...current.records, ...overrides.records },
  } as GameConfig;
  return current;
}

/** 테스트에서 기본값으로 되돌리기 위한 헬퍼. */
export function resetGameConfig(): void {
  current = DEFAULT_GAME_CONFIG;
}

/** 게임 오버가 되는 오답 횟수(= max + 1). */
export function gameOverAtMistake(config: GameConfig = getGameConfig()): number {
  return config.mistakes.max + 1;
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
