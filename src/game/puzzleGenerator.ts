import { GENERATOR_VERSION, getGameConfig, getPuzzleConfig, type PuzzleConfig } from '@/config';
import { getWordRepository, type WordRepository } from '@/data/repositories';
import type { Puzzle, WordEntry } from '@/types';
import { createRng, createSeedString, type Rng } from '@/utils/random';
import { LayoutBuilder, type PlacedWord, type PlacementCandidate } from './layout';
import { assemblePuzzle, type RawPlacement } from './puzzleAssembly';
import { checkQuality, toWordLike, type QualityResult } from './puzzleValidator';
import { selectCandidates } from './wordSelection';

/**
 * 퍼즐 생성기. (요구사항 9·10·11·55)
 *
 * 전체 흐름
 *   1) 시드로부터 목표 단어 수 · 목표 난이도 결정
 *   2) WordRepository 에서 후보 단어 풀 선택
 *   3) 격자에 단어를 하나씩 배치하며 후보 레이아웃 생성
 *   4) 연결성 / 충돌 / 모양 품질 검사
 *   5) 여러 후보 중 모양 점수가 가장 높은 것 선택
 *   6) 전부 실패하면 기준을 완화, 그래도 실패하면 fallback 퍼즐
 *
 * 모든 무작위성은 seed 기반 RNG 에서 나오므로, 같은 seed + 같은 단어 데이터면
 * 항상 같은 퍼즐이 만들어진다. (요구사항 36·37)
 */

export interface GeneratePuzzleOptions {
  /** 시드. 없으면 새로 만든다. */
  seed?: string;
  repository?: WordRepository;
  /** 목표 단어 수를 강제한다. 지정하지 않으면 시드로 결정한다. */
  targetWordCount?: number;
  config?: PuzzleConfig;
}

export async function generatePuzzle(options: GeneratePuzzleOptions = {}): Promise<Puzzle> {
  const config = options.config ?? getPuzzleConfig();
  const gameConfig = getGameConfig();
  const repository = options.repository ?? getWordRepository();
  const seed = options.seed ?? createSeedString();

  const sourceInfo = await repository.getSourceInfo();
  const seedRng = createRng(`${seed}:meta`);

  const targetWordCount = clamp(
    options.targetWordCount ??
      seedRng.range(gameConfig.words.preferredMin, gameConfig.words.preferredMax),
    gameConfig.words.min,
    gameConfig.words.max,
  );

  const budget = Math.min(
    config.attempts.hardLimit,
    config.attempts.candidates * config.attempts.maxRetriesPerCandidate,
  );

  interface Attempt {
    placed: PlacedWord[];
    quality: QualityResult;
  }
  const strictResults: Attempt[] = [];
  const relaxedResults: Attempt[] = [];
  const weakResults: Attempt[] = [];
  let attempts = 0;

  for (let i = 0; i < budget; i++) {
    attempts++;
    // 후보마다 다른(그러나 시드로부터 결정되는) RNG 를 쓴다.
    const rng = createRng(`${seed}#${i}`);
    const { pool } = await selectCandidates({ repository, rng, targetWordCount });
    if (pool.length === 0) break;

    const builder = buildLayout(pool, rng, targetWordCount, config);
    if (builder.placed.length === 0) continue;
    const words = toWordLike(builder.placed);

    const strict = checkQuality(words, { strict: true, config });
    if (strict.ok) {
      strictResults.push({ placed: builder.placed, quality: strict });
      if (strictResults.length >= config.attempts.enoughStrictResults) break;
      continue;
    }

    const relaxed = checkQuality(words, { strict: false, config });
    if (relaxed.ok) relaxedResults.push({ placed: builder.placed, quality: relaxed });
    else weakResults.push({ placed: builder.placed, quality: relaxed });
  }

  const best =
    pickBest(strictResults) ??
    pickBest(relaxedResults) ??
    pickBest(weakResults.filter((a) => a.quality.stats.connected && a.quality.stats.wordCount >= 2));

  if (!best) {
    // 모든 시도가 실패했을 때의 마지막 안전망. (요구사항 55)
    return buildFallbackPuzzle({ seed, repository, dictVersion: sourceInfo.version, attempts });
  }

  const isFallback = strictResults.length === 0 && relaxedResults.length === 0;
  if (isFallback) {
    console.warn(
      `[puzzleGenerator] 품질 기준을 만족하는 퍼즐을 만들지 못했습니다. (seed=${seed}) 완화된 결과를 사용합니다.`,
    );
  }

  return assemblePuzzle({
    seed,
    placements: toRawPlacements(best.placed),
    metadata: {
      generatorVersion: GENERATOR_VERSION,
      dictVersion: sourceInfo.version,
      attempts,
      shapeScore: round(best.quality.shapeScore, 2),
      acrossCount: best.quality.stats.acrossCount,
      downCount: best.quality.stats.downCount,
      intersectionCount: best.quality.stats.intersections,
      density: round(best.quality.stats.density, 3),
      isFallback,
    },
  });
}

function pickBest<T extends { quality: QualityResult }>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items.reduce((a, b) => (b.quality.shapeScore > a.quality.shapeScore ? b : a));
}

function toRawPlacements(placed: readonly PlacedWord[]): RawPlacement[] {
  return placed.map((word) => ({
    wordId: word.entry.id,
    word: word.entry.normalizedWord,
    direction: word.direction,
    row: word.row,
    col: word.col,
    clue: word.entry.definition,
    difficulty: word.entry.difficulty,
    category: word.entry.category,
  }));
}

/**
 * 후보 단어 풀로 레이아웃 하나를 만든다. (요구사항 9의 1~8단계)
 */
function buildLayout(
  pool: WordEntry[],
  rng: Rng,
  targetWordCount: number,
  config: PuzzleConfig,
): LayoutBuilder {
  const builder = new LayoutBuilder(config.grid.workRows, config.grid.workCols);
  const maxSize = { rows: config.grid.maxRows, cols: config.grid.maxCols };
  const weights = config.placement.weights;

  // 1) 씨앗 단어: 충분히 길어서 교차를 많이 만들 수 있는 단어를 고른다.
  const seedPool = pool.filter((w) => w.length >= config.selection.seedWordMinLength);
  const first = rng.pick(seedPool.length > 0 ? seedPool : pool);

  // 작업 격자 중앙에 가로로 놓는다. 최종 결과는 바운딩 박스로 잘라 내므로
  // 중앙 배치가 최종 좌표에 영향을 주지 않는다.
  builder.place(
    first,
    'across',
    Math.floor(config.grid.workRows / 2),
    Math.floor((config.grid.workCols - first.length) / 2),
  );

  let remaining = pool.filter((w) => w.id !== first.id);

  while (builder.wordCount < targetWordCount && remaining.length > 0) {
    // 성능을 위해 매 단계 일부만 시도하고, 실패하면 전체로 넓힌다.
    const sample = rng.shuffle(remaining).slice(0, config.placement.wordsPerStep);
    let candidates = collectPlacements(builder, sample, weights, maxSize);

    if (candidates.length === 0 && sample.length < remaining.length) {
      candidates = collectPlacements(builder, remaining, weights, maxSize);
    }
    // 더 이상 놓을 수 있는 단어가 없다.
    if (candidates.length === 0) break;

    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.slice(0, Math.max(1, config.placement.topCandidates));
    const chosen = rng.pick(top);

    builder.place(chosen.entry, chosen.direction, chosen.row, chosen.col);
    remaining = remaining.filter(
      (w) => w.id !== chosen.entry.id && w.normalizedWord !== chosen.entry.normalizedWord,
    );
  }

  return builder;
}

function collectPlacements(
  builder: LayoutBuilder,
  words: readonly WordEntry[],
  weights: PuzzleConfig['placement']['weights'],
  maxSize: { rows: number; cols: number },
): PlacementCandidate[] {
  const out: PlacementCandidate[] = [];
  for (const entry of words) {
    out.push(...builder.findPlacements(entry, weights, maxSize));
  }
  return out;
}

/**
 * 최후의 안전망. 정상 생성이 모두 실패했을 때만 사용한다. (요구사항 55)
 * 품질 기준을 모두 무시하고 놓을 수 있는 만큼 배치한다.
 */
async function buildFallbackPuzzle(args: {
  seed: string;
  repository: WordRepository;
  dictVersion: string;
  attempts: number;
}): Promise<Puzzle> {
  const config = getPuzzleConfig();
  const gameConfig = getGameConfig();
  const rng = createRng(`${args.seed}:fallback`);
  const pool = await args.repository.getSuitableWords({
    minLength: config.selection.minWordLength,
    maxLength: config.selection.maxWordLength,
  });

  if (pool.length === 0) {
    throw new Error(
      '퍼즐을 생성할 수 없습니다. 단어 데이터가 비어 있거나 조건을 만족하는 단어가 없습니다.',
    );
  }

  const builder = new LayoutBuilder(config.grid.workRows, config.grid.workCols);
  const shuffled = rng.shuffle(pool);
  builder.place(
    shuffled[0],
    'across',
    Math.floor(config.grid.workRows / 2),
    Math.floor((config.grid.workCols - shuffled[0].length) / 2),
  );

  for (const entry of shuffled.slice(1)) {
    if (builder.wordCount >= gameConfig.words.min) break;
    const placements = builder.findPlacements(entry, config.placement.weights, {
      rows: config.grid.maxRows,
      cols: config.grid.maxCols,
    });
    if (placements.length === 0) continue;
    placements.sort((a, b) => b.score - a.score);
    const chosen = placements[0];
    builder.place(chosen.entry, chosen.direction, chosen.row, chosen.col);
  }

  console.warn('[puzzleGenerator] 정상 생성에 실패하여 fallback 퍼즐을 사용합니다.');
  const quality = checkQuality(toWordLike(builder.placed), { strict: false });

  return assemblePuzzle({
    seed: args.seed,
    placements: toRawPlacements(builder.placed),
    metadata: {
      generatorVersion: GENERATOR_VERSION,
      dictVersion: args.dictVersion,
      attempts: args.attempts,
      shapeScore: round(quality.shapeScore, 2),
      acrossCount: quality.stats.acrossCount,
      downCount: quality.stats.downCount,
      intersectionCount: quality.stats.intersections,
      density: round(quality.stats.density, 3),
      isFallback: true,
    },
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export { evaluateDifficulty, computeChecksum } from './puzzleAssembly';
