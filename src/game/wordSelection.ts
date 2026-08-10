import { getCategoryMix, getPuzzleConfig, type CategoryMixConfig } from '@/config';
import type { WordRepository } from '@/data/repositories';
import type { WordEntry, WordFilters } from '@/types';
import type { Rng } from '@/utils/random';

/**
 * 후보 단어 선택. (요구사항 12·14·15)
 *
 * 단어 DB 전체에서 아무 단어나 뽑지 않고,
 *  - 길이 / 난이도 / 카테고리 / puzzleSuitable
 *  - 카테고리별 목표 비율
 *  - 고유명사·신조어·유행어 비율 상한
 *  - 글자 교차 가능성(자주 쓰이는 음절을 가진 단어 우대)
 * 을 종합해 후보 풀을 만든다.
 */

export interface CandidateSelection {
  /** 배치 시도에 사용할 후보 단어들. */
  pool: WordEntry[];
  /** 이 게임의 목표 평균 난이도. */
  targetDifficulty: number;
}

export interface SelectCandidatesOptions {
  repository: WordRepository;
  rng: Rng;
  /** 목표 단어 수. 풀 크기 계산에 쓰인다. */
  targetWordCount: number;
  /** 이번 후보 선택에서 제외할 단어 ID (재시도 시 조합을 바꾸기 위해). */
  excludeIds?: string[];
  categoryMix?: CategoryMixConfig;
}

export async function selectCandidates(
  options: SelectCandidatesOptions,
): Promise<CandidateSelection> {
  const { repository, rng, targetWordCount, excludeIds } = options;
  const puzzleConfig = getPuzzleConfig();
  const mix = options.categoryMix ?? getCategoryMix();

  // 이 게임의 목표 난이도를 매번 조금씩 다르게 뽑는다. (요구사항 11)
  const { targetMin, targetMax } = puzzleConfig.difficulty;
  const targetDifficulty = targetMin + rng.next() * (targetMax - targetMin);

  const filters: WordFilters = {
    puzzleSuitableOnly: true,
    statuses: ['approved'],
    minLength: puzzleConfig.selection.minWordLength,
    maxLength: puzzleConfig.selection.maxWordLength,
    allowProperNoun: mix.allow.properNoun,
    allowNeologism: mix.allow.neologism,
    allowTrendWord: mix.allow.trendWord,
    allowSlang: mix.allow.slang,
    allowBrand: mix.allow.brand,
    excludeIds,
  };

  const available = await repository.getSuitableWords(filters);
  if (available.length === 0) return { pool: [], targetDifficulty };

  const poolSize = Math.max(
    puzzleConfig.selection.poolMin,
    targetWordCount * puzzleConfig.selection.poolMultiplier,
  );

  const pool = buildWeightedPool(available, {
    rng,
    poolSize,
    targetDifficulty,
    mix,
  });

  return { pool, targetDifficulty };
}

interface BuildPoolOptions {
  rng: Rng;
  poolSize: number;
  targetDifficulty: number;
  mix: CategoryMixConfig;
}

/**
 * 가중치 기반으로 후보 풀을 뽑는다.
 * 비율 상한(고유명사 등)은 뽑는 도중에 검사하여 초과하면 건너뛴다.
 */
function buildWeightedPool(available: WordEntry[], options: BuildPoolOptions): WordEntry[] {
  const { rng, poolSize, targetDifficulty, mix } = options;

  const syllableFrequency = buildSyllableFrequency(available);
  const remaining = available.slice();
  const weights = new Map<string, number>();
  for (const word of remaining) {
    weights.set(word.id, weightOf(word, { targetDifficulty, mix, syllableFrequency }));
  }

  const size = Math.min(poolSize, remaining.length);
  const picked: WordEntry[] = [];
  const counts = { properNoun: 0, neologism: 0, trendWord: 0, slang: 0, brand: 0 };

  // 상한 비율은 최종 퍼즐 단어 수가 아니라 풀 기준으로 여유 있게 적용한다.
  // (배치 과정에서 일부만 살아남으므로 풀에서는 조금 넉넉히 허용)
  const cap = (ratio: number) => Math.max(1, Math.ceil(size * Math.min(1, ratio * 1.5)));
  const caps = {
    properNoun: cap(mix.maxRatio.properNoun),
    neologism: cap(mix.maxRatio.neologism),
    trendWord: cap(mix.maxRatio.trendWord),
    slang: cap(mix.maxRatio.slang),
    brand: cap(mix.maxRatio.brand),
  };

  let guard = remaining.length * 3;
  while (picked.length < size && remaining.length > 0 && guard-- > 0) {
    const chosen = rng.weightedPick(remaining, (w) => weights.get(w.id) ?? 0);
    const index = remaining.indexOf(chosen);
    remaining.splice(index, 1);

    if (chosen.isProperNoun && counts.properNoun >= caps.properNoun) continue;
    if (chosen.isNeologism && counts.neologism >= caps.neologism) continue;
    if (chosen.isTrendWord && counts.trendWord >= caps.trendWord) continue;
    if (chosen.isSlang && counts.slang >= caps.slang) continue;
    if (chosen.isBrand && counts.brand >= caps.brand) continue;

    if (chosen.isProperNoun) counts.properNoun++;
    if (chosen.isNeologism) counts.neologism++;
    if (chosen.isTrendWord) counts.trendWord++;
    if (chosen.isSlang) counts.slang++;
    if (chosen.isBrand) counts.brand++;
    picked.push(chosen);
  }

  return picked;
}

interface WeightContext {
  targetDifficulty: number;
  mix: CategoryMixConfig;
  syllableFrequency: Map<string, number>;
}

/** 단어 하나의 선택 가중치. */
function weightOf(word: WordEntry, ctx: WeightContext): number {
  // 카테고리 목표 비율
  const categoryWeight = ctx.mix.weights[word.category] ?? ctx.mix.defaultWeight;

  // 목표 난이도에 가까울수록 높은 가중치
  const difficultyGap = Math.abs(word.difficulty - ctx.targetDifficulty);
  const difficultyWeight = 1 / (1 + difficultyGap * difficultyGap);

  // 교차 가능성: 자주 등장하는 음절을 가진 단어를 우대한다.
  let crossScore = 0;
  for (const syllable of word.normalizedWord) {
    crossScore += ctx.syllableFrequency.get(syllable) ?? 0;
  }
  const crossWeight = 0.5 + Math.min(1.5, crossScore / (word.length * 6));

  // 2~4글자 단어가 배치에 가장 유리하다.
  const lengthWeight = word.length <= 2 ? 0.8 : word.length <= 4 ? 1.2 : 0.7;

  return categoryWeight * difficultyWeight * crossWeight * lengthWeight;
}

/** 후보 단어 전체에서 각 음절이 몇 번 등장하는지 센다. */
export function buildSyllableFrequency(words: readonly WordEntry[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const word of words) {
    for (const syllable of word.normalizedWord) {
      freq.set(syllable, (freq.get(syllable) ?? 0) + 1);
    }
  }
  return freq;
}
