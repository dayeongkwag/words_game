/**
 * 한글 음절 처리 유틸.
 * 낱말퍼즐은 "음절 하나 = 격자 한 칸" 이므로, 음절 단위 처리가 핵심이다.
 */

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const JUNG_COUNT = 21;
const JONG_COUNT = 28;

/** 초성 19자. */
export const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

/** 완성형 한글 음절인지 판별. */
export function isHangulSyllable(ch: string): boolean {
  if (!ch) return false;
  const code = ch.codePointAt(0);
  return code !== undefined && code >= HANGUL_BASE && code <= HANGUL_END;
}

/** 음절 하나의 초성을 반환. 한글이 아니면 원문 그대로 반환. */
export function getChoseong(ch: string): string {
  if (!isHangulSyllable(ch)) return ch;
  const index = Math.floor((ch.codePointAt(0)! - HANGUL_BASE) / (JUNG_COUNT * JONG_COUNT));
  return CHOSEONG[index] ?? ch;
}

/** 단어 전체의 초성 문자열. 예: "인공지능" → "ㅇㄱㅈㄴ" */
export function getInitials(word: string): string {
  return toSyllables(word).map(getChoseong).join('');
}

/**
 * 단어를 음절(코드포인트) 배열로 분해한다.
 * 서로게이트 페어를 안전하게 처리하기 위해 Array.from 을 사용한다.
 */
export function toSyllables(word: string): string[] {
  return Array.from(word);
}

/** 격자에 사용할 정규화 형태: 공백/구두점 제거. */
export function normalizeWord(word: string): string {
  return word.replace(/[\s .,·'"’”“‘\-–—_()[\]{}]/g, '');
}

/**
 * 퍼즐에 사용 가능한 단어인지 확인한다.
 * 모든 글자가 완성형 한글 음절이어야 한다.
 */
export function isPuzzlePlayable(word: string): boolean {
  const syllables = toSyllables(word);
  return syllables.length > 0 && syllables.every(isHangulSyllable);
}
