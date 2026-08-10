import type { WordCategory } from '@/types';

/**
 * 카테고리 목록과 퍼즐 내 구성 비율.
 * 향후 관리자 페이지에서 비율을 조정할 수 있도록 설정으로 분리한다. (요구사항 12·13·14·46)
 */

export const CATEGORIES: WordCategory[] = [
  '일반',
  '교양/상식',
  '고유명사',
  '신조어',
  '유행어',
  '최신/트렌드',
  '문화',
  '과학',
  '경제',
  '사회',
  '기술',
  '역사',
  '지리',
  '스포츠',
  '음식',
  '자연',
  '기타',
];

export interface CategoryMixConfig {
  /**
   * 카테고리별 가중치. 후보 단어 풀을 만들 때 이 비율에 가깝게 뽑는다.
   * 명시되지 않은 카테고리는 `defaultWeight` 를 사용한다.
   */
  weights: Partial<Record<WordCategory, number>>;
  defaultWeight: number;

  /** 단어 성격별 최대 비율 상한 (0~1). 퍼즐 전체 단어 수 기준. */
  maxRatio: {
    properNoun: number;
    neologism: number;
    trendWord: number;
    slang: number;
    brand: number;
  };

  /** 게임에서 허용할지 여부. false 면 후보에서 아예 제외한다. */
  allow: {
    properNoun: boolean;
    neologism: boolean;
    trendWord: boolean;
    slang: boolean;
    brand: boolean;
  };
}

export const DEFAULT_CATEGORY_MIX: CategoryMixConfig = {
  weights: {
    일반: 3,
    '교양/상식': 2,
    문화: 1.5,
    과학: 1.5,
    사회: 1.2,
    경제: 1,
    기술: 1.2,
    역사: 1,
    지리: 1,
    스포츠: 0.8,
    음식: 1,
    자연: 1,
    고유명사: 0.8,
    신조어: 0.6,
    유행어: 0.5,
    '최신/트렌드': 0.6,
    기타: 0.5,
  },
  defaultWeight: 1,

  // 고유명사·신조어·유행어는 허용하되 퍼즐을 지배하지 않도록 상한을 둔다.
  maxRatio: {
    properNoun: 0.3,
    neologism: 0.2,
    trendWord: 0.15,
    slang: 0.1,
    brand: 0.15,
  },

  allow: {
    properNoun: true,
    neologism: true,
    trendWord: true,
    slang: true,
    brand: true,
  },
};

let current: CategoryMixConfig = DEFAULT_CATEGORY_MIX;

export function getCategoryMix(): CategoryMixConfig {
  return current;
}

export function resetCategoryMix(): void {
  current = DEFAULT_CATEGORY_MIX;
}
