import { beforeEach, describe, expect, it } from 'vitest';
import { getGameConfig, resetGameConfig, resetPuzzleConfig } from '@/config';
import { MockWordRepository } from '@/data/repositories';
import { generatePuzzle } from './puzzleGenerator';
import { checkQuality, placementsToWordLike, validatePuzzle } from './puzzleValidator';

/**
 * 퍼즐 생성 테스트. (요구사항 56)
 *  - 모든 단어가 연결되는가
 *  - 충돌이 없는가
 *  - 가로/세로 방향이 정상인가
 *  - 7~20개 단어 조건을 지키는가
 *  - 동일 퍼즐 재현이 가능한가
 */

const SEEDS = ['seed1', 'k7m2p9', 'abcde', 'zz99xx', 'puzzle7', 'hello', 'nalmal', 'test42'];

describe('generatePuzzle', () => {
  const repository = new MockWordRepository();

  beforeEach(() => {
    resetGameConfig();
    resetPuzzleConfig();
  });

  it('단어 수가 설정된 범위(7~20개) 안에 들어온다', async () => {
    const config = getGameConfig();
    for (const seed of SEEDS) {
      const puzzle = await generatePuzzle({ seed, repository });
      expect(puzzle.words.length, `seed=${seed}`).toBeGreaterThanOrEqual(config.words.min);
      expect(puzzle.words.length, `seed=${seed}`).toBeLessThanOrEqual(config.words.max);
    }
  });

  it('격자에 글자 충돌이 없고 배치 정보와 격자가 일치한다', async () => {
    for (const seed of SEEDS) {
      const puzzle = await generatePuzzle({ seed, repository });
      const result = validatePuzzle(puzzle);
      expect(result.issues, `seed=${seed}`).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it('모든 단어가 하나로 연결되고 고립 단어가 없다', async () => {
    for (const seed of SEEDS) {
      const puzzle = await generatePuzzle({ seed, repository });
      const { stats } = checkQuality(placementsToWordLike(puzzle.words), { strict: false });
      expect(stats.connected, `seed=${seed}`).toBe(true);
      expect(stats.isolatedWords, `seed=${seed}`).toBe(0);
      expect(stats.conflicts, `seed=${seed}`).toEqual([]);
    }
  });

  it('가로와 세로가 모두 존재하며 한쪽으로 지나치게 몰리지 않는다', async () => {
    for (const seed of SEEDS) {
      const puzzle = await generatePuzzle({ seed, repository });
      expect(puzzle.metadata.acrossCount, `seed=${seed}`).toBeGreaterThan(0);
      expect(puzzle.metadata.downCount, `seed=${seed}`).toBeGreaterThan(0);
      const ratio =
        Math.max(puzzle.metadata.acrossCount, puzzle.metadata.downCount) / puzzle.words.length;
      expect(ratio, `seed=${seed}`).toBeLessThanOrEqual(0.8);
    }
  });

  it('모든 단어가 격자 범위 안에 있고 방향에 맞게 배치된다', async () => {
    const puzzle = await generatePuzzle({ seed: 'layout-check', repository });
    for (const word of puzzle.words) {
      const endRow = word.startRow + (word.direction === 'down' ? word.length - 1 : 0);
      const endCol = word.startCol + (word.direction === 'across' ? word.length - 1 : 0);
      expect(word.startRow).toBeGreaterThanOrEqual(0);
      expect(word.startCol).toBeGreaterThanOrEqual(0);
      expect(endRow).toBeLessThan(puzzle.rows);
      expect(endCol).toBeLessThan(puzzle.cols);
      expect(Array.from(word.word).length).toBe(word.length);
    }
  });

  it('같은 seed 로는 항상 완전히 동일한 퍼즐이 만들어진다 (재현성)', async () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const a = await generatePuzzle({ seed, repository });
      // 캐시 영향을 배제하기 위해 새 리포지토리 인스턴스를 쓴다.
      const b = await generatePuzzle({ seed, repository: new MockWordRepository() });

      expect(b.checksum, `seed=${seed}`).toBe(a.checksum);
      expect(b.rows).toBe(a.rows);
      expect(b.cols).toBe(a.cols);
      expect(b.words.map((w) => `${w.wordId}@${w.startRow},${w.startCol},${w.direction}`)).toEqual(
        a.words.map((w) => `${w.wordId}@${w.startRow},${w.startCol},${w.direction}`),
      );
    }
  });

  it('서로 다른 seed 는 서로 다른 퍼즐을 만든다', async () => {
    const checksums = new Set<string>();
    for (const seed of SEEDS) {
      const puzzle = await generatePuzzle({ seed, repository });
      checksums.add(puzzle.checksum);
    }
    // 완전히 모두 달라야 하는 것은 아니지만, 대부분은 달라야 한다.
    expect(checksums.size).toBeGreaterThanOrEqual(SEEDS.length - 1);
  });

  it('문제 번호가 왼쪽 위에서 오른쪽 아래 순서로 부여된다', async () => {
    const puzzle = await generatePuzzle({ seed: 'numbering', repository });
    const byNumber = new Map<number, { row: number; col: number }>();
    for (const word of puzzle.words) {
      const existing = byNumber.get(word.number);
      if (existing) {
        // 같은 번호는 같은 시작 칸이어야 한다.
        expect(existing).toEqual({ row: word.startRow, col: word.startCol });
      } else {
        byNumber.set(word.number, { row: word.startRow, col: word.startCol });
      }
    }
    const ordered = [...byNumber.entries()].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1][1];
      const current = ordered[i][1];
      const prevRank = prev.row * puzzle.cols + prev.col;
      const currentRank = current.row * puzzle.cols + current.col;
      expect(currentRank).toBeGreaterThan(prevRank);
    }
  });

  it('격자가 화면에 들어오는 크기를 넘지 않는다', async () => {
    for (const seed of SEEDS) {
      const puzzle = await generatePuzzle({ seed, repository });
      expect(puzzle.rows, `seed=${seed}`).toBeLessThanOrEqual(15);
      expect(puzzle.cols, `seed=${seed}`).toBeLessThanOrEqual(15);
    }
  });

  it('같은 단어가 한 퍼즐에 두 번 들어가지 않는다', async () => {
    for (const seed of SEEDS) {
      const puzzle = await generatePuzzle({ seed, repository });
      const words = puzzle.words.map((w) => w.word);
      expect(new Set(words).size, `seed=${seed}`).toBe(words.length);
    }
  });
});
