import { GENERATOR_VERSION, getShareConfig, type ShareConfig } from '@/config';
import { getWordRepository, type WordRepository } from '@/data/repositories';
import type { Puzzle, PuzzleSnapshot, WordCategory, WordDifficulty } from '@/types';
import { fromBase64Url, toBase64Url } from '@/utils/base64';
import { isValidSeed } from '@/utils/random';
import { assemblePuzzle, type RawPlacement } from './puzzleAssembly';
import { generatePuzzle } from './puzzleGenerator';

/**
 * 동일 퍼즐 공유 / 재현. (요구사항 36·37·38)
 *
 * 기본 방식은 **seed 링크**다. 링크에는 seed 와 체크섬만 담기고,
 * 링크를 연 사람의 브라우저에서 같은 알고리즘으로 퍼즐을 다시 만든다.
 *
 * 단어 DB가 바뀌면 같은 seed 라도 다른 퍼즐이 나올 수 있으므로,
 *  - 링크에 체크섬(c)·생성기 버전(g)·데이터 버전(d)을 함께 기록하고
 *  - 재생성 결과가 다르면 사용자에게 알려 준다.
 *
 * 링크가 오래 살아남아야 하는 경우를 위해 **snapshot 링크**(배치 정보를 통째로 담는 방식)도
 * 지원한다. `shareConfig.linkMode` 로 전환한다.
 */

const SNAPSHOT_VERSION = 1;

// ── 스냅샷 ────────────────────────────────────────────────────────────

export function toSnapshot(puzzle: Puzzle): PuzzleSnapshot {
  return {
    v: SNAPSHOT_VERSION,
    id: puzzle.puzzleId,
    seed: puzzle.seed,
    rows: puzzle.rows,
    cols: puzzle.cols,
    words: puzzle.words.map((w) => [
      w.wordId,
      w.word,
      w.direction === 'across' ? 0 : 1,
      w.startRow,
      w.startCol,
      w.difficulty,
      w.clue,
    ]),
  };
}

/** 스냅샷으로부터 퍼즐을 그대로 복원한다. 단어 DB가 바뀌어도 결과가 동일하다. */
export function puzzleFromSnapshot(snapshot: PuzzleSnapshot): Puzzle {
  const placements: RawPlacement[] = snapshot.words.map(
    ([wordId, word, direction, row, col, difficulty, clue]) => ({
      wordId,
      word,
      direction: direction === 0 ? 'across' : 'down',
      row,
      col,
      clue,
      difficulty: difficulty as WordDifficulty,
      category: '기타' as WordCategory,
    }),
  );

  return assemblePuzzle({
    seed: snapshot.seed,
    placements,
    metadata: {
      generatorVersion: GENERATOR_VERSION,
      dictVersion: 'snapshot',
      attempts: 0,
      shapeScore: 0,
      acrossCount: placements.filter((p) => p.direction === 'across').length,
      downCount: placements.filter((p) => p.direction === 'down').length,
      intersectionCount: 0,
      density: 0,
      isFallback: false,
    },
  });
}

export function encodeSnapshot(puzzle: Puzzle): string {
  return toBase64Url(JSON.stringify(toSnapshot(puzzle)));
}

export function decodeSnapshot(encoded: string): PuzzleSnapshot | null {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as PuzzleSnapshot;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.v !== SNAPSHOT_VERSION) return null;
    if (!Array.isArray(parsed.words) || parsed.words.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── 링크 만들기 / 읽기 ────────────────────────────────────────────────

export interface ShareLinkParams {
  seed?: string;
  snapshot?: string;
  generatorVersion?: string;
  dictVersion?: string;
  checksum?: string;
}

/** 퍼즐 공유용 URL 을 만든다. */
export function buildShareUrl(
  puzzle: Puzzle,
  options: { baseUrl?: string; config?: ShareConfig } = {},
): string {
  const config = options.config ?? getShareConfig();
  const base = options.baseUrl ?? currentBaseUrl();
  const url = new URL(base);
  // 기존 퍼즐 파라미터는 제거하고 새로 채운다.
  for (const key of Object.values(config.params)) url.searchParams.delete(key);

  if (config.linkMode === 'snapshot') {
    url.searchParams.set(config.params.snapshot, encodeSnapshot(puzzle));
  } else {
    url.searchParams.set(config.params.seed, puzzle.seed);
    url.searchParams.set(config.params.generatorVersion, puzzle.metadata.generatorVersion);
    url.searchParams.set(config.params.dictVersion, puzzle.metadata.dictVersion);
    url.searchParams.set(config.params.checksum, puzzle.checksum);
  }

  return url.toString();
}

/** URL 쿼리스트링에서 퍼즐 파라미터를 읽는다. */
export function parseShareParams(
  search: string,
  config: ShareConfig = getShareConfig(),
): ShareLinkParams | null {
  const params = new URLSearchParams(search);
  const seed = params.get(config.params.seed) ?? undefined;
  const snapshot = params.get(config.params.snapshot) ?? undefined;
  if (!seed && !snapshot) return null;

  return {
    seed: seed && isValidSeed(seed) ? seed : undefined,
    snapshot: snapshot ?? undefined,
    generatorVersion: params.get(config.params.generatorVersion) ?? undefined,
    dictVersion: params.get(config.params.dictVersion) ?? undefined,
    checksum: params.get(config.params.checksum) ?? undefined,
  };
}

export interface RestoreResult {
  puzzle: Puzzle;
  /** 공유한 사람이 푼 퍼즐과 완전히 동일한지. */
  exact: boolean;
  /** 완전히 동일하지 않은 경우의 사유(사용자에게 안내). */
  warning?: string;
}

/**
 * 공유 링크로부터 퍼즐을 복원한다. (요구사항 37)
 *
 * 1) snapshot 이 있으면 그대로 복원 → 항상 동일
 * 2) seed 로 재생성 → 체크섬이 일치하면 동일, 다르면 경고와 함께 재생성본 사용
 */
export async function restoreSharedPuzzle(
  params: ShareLinkParams,
  options: { repository?: WordRepository } = {},
): Promise<RestoreResult | null> {
  if (params.snapshot) {
    const snapshot = decodeSnapshot(params.snapshot);
    if (snapshot) return { puzzle: puzzleFromSnapshot(snapshot), exact: true };
    return null;
  }

  if (!params.seed) return null;

  const repository = options.repository ?? getWordRepository();
  const puzzle = await generatePuzzle({ seed: params.seed, repository });

  if (params.checksum && params.checksum !== puzzle.checksum) {
    return {
      puzzle,
      exact: false,
      warning:
        params.generatorVersion && params.generatorVersion !== puzzle.metadata.generatorVersion
          ? '퍼즐 생성 방식이 업데이트되어 원래와 조금 다른 퍼즐이 만들어졌습니다.'
          : '단어 데이터가 변경되어 원래와 조금 다른 퍼즐이 만들어졌습니다.',
    };
  }

  return { puzzle, exact: true };
}

// ── 공유 실행 ────────────────────────────────────────────────────────

export type ShareOutcome = 'shared' | 'copied' | 'failed';

/**
 * Web Share API 를 우선 사용하고, 지원하지 않으면 클립보드로 복사한다. (요구사항 35)
 */
export async function shareText(text: string, url: string): Promise<ShareOutcome> {
  const config = getShareConfig();
  const payload = `${text}\n${url}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: config.title, text, url });
      return 'shared';
    } catch (error) {
      // 사용자가 취소한 경우는 실패로 보지 않는다.
      if (error instanceof DOMException && error.name === 'AbortError') return 'failed';
      // 그 외에는 클립보드로 폴백한다.
    }
  }

  return (await copyToClipboard(payload)) ? 'copied' : 'failed';
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 아래의 폴백을 시도한다.
  }

  // 구형 iOS Safari 등을 위한 폴백
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function currentBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://example.com/';
  return `${window.location.origin}${window.location.pathname}`;
}
