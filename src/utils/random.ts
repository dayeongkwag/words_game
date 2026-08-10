/**
 * 시드 기반 난수 생성기.
 *
 * 퍼즐 재현(요구사항 36·37)의 토대다. 퍼즐 생성 과정의 모든 무작위성은
 * 반드시 이 RNG 를 통해야 하며, `Math.random()` 을 직접 쓰면 재현이 깨진다.
 */

/** 문자열 → 32bit 정수 해시 (xmur3). */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [0, max) 정수 */
  int(max: number): number;
  /** [min, max] 정수 */
  range(min: number, max: number): number;
  /** 배열에서 하나 선택. */
  pick<T>(items: readonly T[]): T;
  /** 새 배열을 반환하는 Fisher-Yates 셔플. */
  shuffle<T>(items: readonly T[]): T[];
  /** 가중치 기반 선택. weights 합이 0이면 균등 선택. */
  weightedPick<T>(items: readonly T[], weightOf: (item: T) => number): T;
}

/** mulberry32 기반 결정론적 RNG. */
export function createRng(seed: string | number): Rng {
  let state = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
  // 시드가 0이면 mulberry32 가 퇴화하므로 보정한다.
  if (state === 0) state = 0x9e3779b9;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (max: number): number => (max <= 0 ? 0 : Math.floor(next() * max));

  return {
    next,
    int,
    range: (min, max) => min + int(max - min + 1),
    pick: (items) => items[int(items.length)],
    shuffle: (items) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    weightedPick: (items, weightOf) => {
      let total = 0;
      for (const item of items) total += Math.max(0, weightOf(item));
      if (total <= 0) return items[int(items.length)];
      let roll = next() * total;
      for (const item of items) {
        roll -= Math.max(0, weightOf(item));
        if (roll <= 0) return item;
      }
      return items[items.length - 1];
    },
  };
}

const SEED_ALPHABET = 'abcdefghijkmnopqrstuvwxyz23456789';

/**
 * 사람이 공유하기 좋은 짧은 시드 문자열을 만든다.
 * 혼동되기 쉬운 문자(l, 1, 0, o)는 알파벳에서 제외했다.
 */
export function createSeedString(length = 8, random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SEED_ALPHABET[Math.floor(random() * SEED_ALPHABET.length)];
  }
  return out;
}

/** 공유 링크에 들어온 시드 문자열이 안전한지 검증한다. */
export function isValidSeed(seed: string): boolean {
  return /^[a-z0-9]{4,32}$/.test(seed);
}
