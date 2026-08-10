import { beforeEach, describe, expect, it } from 'vitest';
import { getShareConfig, resetGameConfig, resetPuzzleConfig, resetShareConfig } from '@/config';
import { MockWordRepository } from '@/data/repositories';
import { generatePuzzle } from './puzzleGenerator';
import {
  buildShareUrl,
  decodeSnapshot,
  encodeSnapshot,
  parseShareParams,
  puzzleFromSnapshot,
  restoreSharedPuzzle,
  toSnapshot,
} from './puzzleShare';

/**
 * 공유 / 재현 테스트. (요구사항 36·37·56)
 *  - puzzleId(seed)로 동일 퍼즐 재현
 *  - 공유 링크 정상 동작
 *  - 단어 DB가 바뀌어도 깨지지 않는 스냅샷 경로
 */

const repository = new MockWordRepository();
const BASE_URL = 'https://example.com/puzzle';

describe('공유 링크', () => {
  beforeEach(() => {
    resetGameConfig();
    resetPuzzleConfig();
    resetShareConfig();
  });

  it('seed 링크를 만들고 다시 읽을 수 있다', async () => {
    const puzzle = await generatePuzzle({ seed: 'share01', repository });
    const url = buildShareUrl(puzzle, { baseUrl: BASE_URL });
    const config = getShareConfig();

    expect(url).toContain(`${config.params.seed}=share01`);

    const params = parseShareParams(new URL(url).search);
    expect(params?.seed).toBe('share01');
    expect(params?.checksum).toBe(puzzle.checksum);
    expect(params?.generatorVersion).toBe(puzzle.metadata.generatorVersion);
  });

  it('공유 링크로 들어오면 완전히 동일한 퍼즐이 복원된다', async () => {
    const original = await generatePuzzle({ seed: 'share02', repository });
    const params = parseShareParams(new URL(buildShareUrl(original, { baseUrl: BASE_URL })).search);
    expect(params).not.toBeNull();

    const restored = await restoreSharedPuzzle(params!, {
      repository: new MockWordRepository(),
    });

    expect(restored).not.toBeNull();
    expect(restored!.exact).toBe(true);
    expect(restored!.puzzle.checksum).toBe(original.checksum);
    expect(restored!.puzzle.words.map((w) => w.word)).toEqual(original.words.map((w) => w.word));
  });

  it('체크섬이 다르면 재현 실패를 알려 준다', async () => {
    const original = await generatePuzzle({ seed: 'share03', repository });
    const restored = await restoreSharedPuzzle(
      { seed: original.seed, checksum: 'tampered' },
      { repository },
    );

    expect(restored).not.toBeNull();
    expect(restored!.exact).toBe(false);
    expect(restored!.warning).toBeTruthy();
  });

  it('퍼즐 파라미터가 없으면 null 을 반환한다', () => {
    expect(parseShareParams('')).toBeNull();
    expect(parseShareParams('?foo=bar')).toBeNull();
  });

  it('잘못된 형식의 seed 는 무시한다', () => {
    const config = getShareConfig();
    const params = parseShareParams(`?${config.params.seed}=${encodeURIComponent('../evil')}`);
    expect(params?.seed).toBeUndefined();
  });
});

describe('스냅샷 (단어 DB 변경 대비)', () => {
  beforeEach(() => {
    resetGameConfig();
    resetPuzzleConfig();
    resetShareConfig();
  });

  it('스냅샷을 인코딩/디코딩해도 배치가 그대로 유지된다', async () => {
    const original = await generatePuzzle({ seed: 'snap01', repository });
    const decoded = decodeSnapshot(encodeSnapshot(original));

    expect(decoded).not.toBeNull();
    expect(decoded).toEqual(toSnapshot(original));
  });

  it('스냅샷으로 복원한 퍼즐은 원본과 격자·문제가 동일하다', async () => {
    const original = await generatePuzzle({ seed: 'snap02', repository });
    const restored = puzzleFromSnapshot(toSnapshot(original));

    expect(restored.rows).toBe(original.rows);
    expect(restored.cols).toBe(original.cols);
    expect(restored.checksum).toBe(original.checksum);
    expect(restored.grid).toEqual(original.grid);
    expect(restored.words.map((w) => [w.number, w.word, w.direction, w.clue])).toEqual(
      original.words.map((w) => [w.number, w.word, w.direction, w.clue]),
    );
  });

  it('망가진 스냅샷 문자열은 null 을 반환한다', () => {
    expect(decodeSnapshot('not-a-valid-snapshot')).toBeNull();
    expect(decodeSnapshot('')).toBeNull();
  });

  it('snapshot 링크는 단어 데이터와 무관하게 복원된다', async () => {
    const original = await generatePuzzle({ seed: 'snap03', repository });
    const restored = await restoreSharedPuzzle({ snapshot: encodeSnapshot(original) });

    expect(restored!.exact).toBe(true);
    expect(restored!.puzzle.checksum).toBe(original.checksum);
  });
});
