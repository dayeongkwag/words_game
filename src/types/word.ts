/**
 * 단어 데이터 모델.
 *
 * 이 구조는 향후 프로젝트에 추가될 `data/approved_words.json` 의 레코드 구조와
 * 1:1로 대응한다. 데이터 소스(JSON / Supabase / API)가 무엇이든 게임 엔진은
 * 오직 이 타입만을 본다.
 */

/** 단어 승인 상태. 게임에는 `approved` 만 사용한다. */
export type WordStatus = 'approved' | 'pending' | 'rejected';

/**
 * 난이도. 1(가장 쉬움) ~ 5(가장 어려움).
 * 실제 DB의 difficulty 값을 그대로 사용한다.
 */
export type WordDifficulty = 1 | 2 | 3 | 4 | 5;

/**
 * 카테고리. 실제 DB의 category 값을 우선 사용하므로 자유 문자열도 허용한다.
 * (알려진 값은 자동완성을 위해 유니온으로 나열)
 */
export type WordCategory =
  | '일반'
  | '교양/상식'
  | '고유명사'
  | '신조어'
  | '유행어'
  | '최신/트렌드'
  | '문화'
  | '과학'
  | '경제'
  | '사회'
  | '기술'
  | '역사'
  | '지리'
  | '스포츠'
  | '음식'
  | '자연'
  | '기타'
  | (string & {});

/** 단어 한 개. approved_words.json 의 레코드와 동일한 형태. */
export interface WordEntry {
  /** 고유 ID. 예: "wd-000001". 퍼즐 재현의 기준이 되는 안정적 식별자. */
  id: string;
  /** 표기 단어. 예: "인공지능" */
  word: string;
  /** 정규화된 단어(공백/특수문자 제거). 격자 배치와 정답 비교에 사용. */
  normalizedWord: string;
  /** normalizedWord 의 음절 수 = 격자에서 차지하는 칸 수. */
  length: number;
  category: WordCategory;
  subcategory?: string;
  difficulty: WordDifficulty;
  /** 문제로 출제될 설명(clue). */
  definition: string;
  isProperNoun: boolean;
  isSlang: boolean;
  isNeologism: boolean;
  isTrendWord: boolean;
  isBrand: boolean;
  /** 낱말퍼즐에 적합한지 여부. false 인 단어는 퍼즐에 쓰지 않는다. */
  puzzleSuitable: boolean;
  status: WordStatus;
}

/** WordRepository 조회에 사용하는 필터. 모든 필드는 선택적(AND 결합). */
export interface WordFilters {
  /** 포함할 난이도 목록. */
  difficulties?: WordDifficulty[];
  /** 난이도 범위 (양끝 포함). */
  minDifficulty?: WordDifficulty;
  maxDifficulty?: WordDifficulty;
  /** 포함할 카테고리 목록. */
  categories?: WordCategory[];
  /** 제외할 카테고리 목록. */
  excludeCategories?: WordCategory[];
  /** 글자 수 범위 (양끝 포함). */
  minLength?: number;
  maxLength?: number;
  /** 정확한 글자 수. */
  length?: number;
  /** true 면 puzzleSuitable === true 인 단어만. 기본값 true. */
  puzzleSuitableOnly?: boolean;
  /** 포함할 status. 기본값 ['approved'] */
  statuses?: WordStatus[];
  /** 고유명사 허용 여부. 기본값 true. */
  allowProperNoun?: boolean;
  /** 신조어 허용 여부. 기본값 true. */
  allowNeologism?: boolean;
  /** 유행어 허용 여부. 기본값 true. */
  allowTrendWord?: boolean;
  /** 비속어/은어 허용 여부. 기본값 true. */
  allowSlang?: boolean;
  /** 브랜드명 허용 여부. 기본값 true. */
  allowBrand?: boolean;
  /** 제외할 단어 ID 목록. */
  excludeIds?: string[];
}

/** 데이터 소스 메타데이터. 공유 링크 호환성 판단에 사용한다. */
export interface WordSourceInfo {
  /** 'mock' | 'json' | 'supabase' | 'api' 등 */
  kind: string;
  /**
   * 단어 데이터셋 버전. 공유 링크에 기록되어, 링크를 열었을 때
   * 데이터가 바뀌었는지 판단하는 근거가 된다.
   */
  version: string;
  /** 사용 가능한(필터 통과 전) 전체 단어 수. */
  totalCount: number;
}
