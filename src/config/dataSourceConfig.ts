/**
 * 사용할 단어 데이터 소스 선택. (요구사항 61)
 *
 * - `mock` : 개발/테스트용 내장 단어 데이터
 * - `json` : 프로젝트 루트의 `data/approved_words.json`
 *
 * 환경변수 `VITE_WORD_SOURCE` 로 덮어쓸 수 있다.
 * 향후 'supabase' | 'api' 를 추가할 때도 이 파일과 리포지토리 팩토리만 수정하면 된다.
 */
export type WordSourceKind = 'mock' | 'json';

const fromEnv = (import.meta.env?.VITE_WORD_SOURCE ?? '').toString().trim();

/**
 * 기본값은 'json' 이다.
 * `data/approved_words.json` 이 아직 없으면 JSONWordRepository 가 자동으로
 * mock 데이터로 폴백하므로, 파일을 추가하는 것만으로 실제 DB 로 전환된다.
 */
export const WORD_SOURCE: WordSourceKind =
  fromEnv === 'mock' || fromEnv === 'json' ? fromEnv : 'json';
