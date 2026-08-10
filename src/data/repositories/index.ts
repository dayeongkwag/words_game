import { WORD_SOURCE, type WordSourceKind } from '@/config';
import { JSONWordRepository } from './JSONWordRepository';
import { MockWordRepository } from './MockWordRepository';
import type { WordRepository } from './WordRepository';

export { BaseWordRepository, matchesFilters } from './WordRepository';
export type { WordRepository } from './WordRepository';
export { MockWordRepository } from './MockWordRepository';
export { JSONWordRepository } from './JSONWordRepository';

/**
 * 리포지토리 팩토리. (요구사항 61·62)
 *
 * 데이터 소스를 바꾸려면 이 함수와 `dataSourceConfig.ts` 만 수정하면 되고,
 * PuzzleGenerator / Scoring / HintSystem / GameState / UI 는 손대지 않는다.
 *
 * 향후 추가 예시:
 *   case 'supabase': return new SupabaseWordRepository(client);
 *   case 'api':      return new ApiWordRepository(baseUrl);
 */
export function createWordRepository(kind: WordSourceKind = WORD_SOURCE): WordRepository {
  switch (kind) {
    case 'mock':
      return new MockWordRepository();
    case 'json':
      return new JSONWordRepository();
    default: {
      const exhaustive: never = kind;
      throw new Error(`알 수 없는 단어 데이터 소스: ${String(exhaustive)}`);
    }
  }
}

let shared: WordRepository | null = null;

/** 앱 전역에서 공유하는 리포지토리 인스턴스(캐시 재사용 목적). */
export function getWordRepository(): WordRepository {
  if (!shared) shared = createWordRepository();
  return shared;
}

/** 테스트/관리자에서 리포지토리를 교체한다. */
export function setWordRepository(repository: WordRepository | null): void {
  shared = repository;
}
