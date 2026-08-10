import { describe, expect, it } from 'vitest';
import { createRng } from '@/utils/random';
import { isPuzzlePlayable } from '@/utils/hangul';
import { MockWordRepository } from './MockWordRepository';

/** WordRepository 계층 테스트. (요구사항 3·6) */

describe('MockWordRepository', () => {
  const repository = new MockWordRepository();

  it('충분한 양의 단어를 제공한다', async () => {
    const words = await repository.getAllWords();
    expect(words.length).toBeGreaterThanOrEqual(150);
  });

  it('모든 단어가 퍼즐에 쓸 수 있는 완성형 한글이다', async () => {
    const words = await repository.getAllWords();
    for (const word of words) {
      expect(isPuzzlePlayable(word.normalizedWord), word.word).toBe(true);
      expect(word.length).toBe(Array.from(word.normalizedWord).length);
    }
  });

  it('ID 가 중복되지 않고 항상 같은 순서로 반환된다', async () => {
    const first = await repository.getAllWords();
    const second = await new MockWordRepository().getAllWords();
    expect(new Set(first.map((w) => w.id)).size).toBe(first.length);
    expect(second.map((w) => w.id)).toEqual(first.map((w) => w.id));
  });

  it('난이도로 필터링한다', async () => {
    const words = await repository.getWordsByDifficulty(3);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.difficulty === 3)).toBe(true);
  });

  it('카테고리로 필터링한다', async () => {
    const words = await repository.getWordsByCategory('과학');
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.category === '과학')).toBe(true);
  });

  it('글자 수로 필터링한다', async () => {
    const words = await repository.getWordsByLength(4);
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.length === 4)).toBe(true);
  });

  it('복합 필터를 AND 로 적용한다', async () => {
    const words = await repository.getSuitableWords({
      minLength: 2,
      maxLength: 3,
      maxDifficulty: 2,
      allowProperNoun: false,
    });
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.length >= 2 && w.length <= 3)).toBe(true);
    expect(words.every((w) => w.difficulty <= 2)).toBe(true);
    expect(words.every((w) => !w.isProperNoun)).toBe(true);
  });

  it('ID 와 표기로 단어를 찾는다', async () => {
    const all = await repository.getAllWords();
    const sample = all[10];
    expect(await repository.getWordById(sample.id)).toEqual(sample);
    expect(await repository.getWordByText(sample.word)).toEqual(sample);
    expect(await repository.getWordById('없는-id')).toBeNull();
  });

  it('같은 RNG 시드로는 항상 같은 무작위 단어를 반환한다', async () => {
    const a = await repository.getRandomWords(10, {}, createRng('seed-a'));
    const b = await repository.getRandomWords(10, {}, createRng('seed-a'));
    const c = await repository.getRandomWords(10, {}, createRng('seed-b'));

    expect(a.map((w) => w.id)).toEqual(b.map((w) => w.id));
    expect(a.map((w) => w.id)).not.toEqual(c.map((w) => w.id));
  });

  it('데이터 소스 메타데이터를 제공한다', async () => {
    const info = await repository.getSourceInfo();
    expect(info.kind).toBe('mock');
    expect(info.totalCount).toBeGreaterThan(0);
    expect(info.version).toContain('mock');
  });

  it('승인되지 않은 단어는 기본적으로 제외한다', async () => {
    const words = await repository.getSuitableWords();
    expect(words.every((w) => w.status === 'approved' && w.puzzleSuitable)).toBe(true);
  });
});
