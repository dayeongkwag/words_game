import { beforeEach, describe, expect, it } from 'vitest';
import { resetGameConfig } from '@/config';
import type { GameResult } from '@/types';
import { RecordStore } from './recordStore';
import { MemoryStorageAdapter } from './StorageAdapter';
import { ThemeStore, resolveTheme } from './themeStore';

/** 저장 테스트. (요구사항 33·41·56) */

function makeResult(overrides: Partial<GameResult> = {}): GameResult {
  return {
    puzzleId: 'abc123',
    seed: 'abc123',
    status: 'COMPLETED',
    score: 1000,
    elapsedMs: 120_000,
    mistakes: 1,
    maxMistakes: 5,
    hintsUsed: 1,
    maxHints: 3,
    solvedWords: 10,
    totalWords: 10,
    difficulty: { score: 2.2, label: '보통' },
    playedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('RecordStore', () => {
  beforeEach(() => resetGameConfig());

  it('기록을 저장하고 최신순으로 읽어 온다', () => {
    const store = new RecordStore(new MemoryStorageAdapter());
    store.add(makeResult({ score: 800, playedAt: 1 }));
    store.add(makeResult({ score: 1200, playedAt: 2 }));
    store.add(makeResult({ score: 950, playedAt: 3 }));

    const records = store.list();
    expect(records).toHaveLength(3);
    expect(records.map((r) => r.score)).toEqual([950, 1200, 800]);
  });

  it('점수 순 정렬과 최고 점수를 제공한다', () => {
    const store = new RecordStore(new MemoryStorageAdapter());
    store.add(makeResult({ score: 800, playedAt: 1 }));
    store.add(makeResult({ score: 1200, playedAt: 2 }));

    expect(store.best(1).map((r) => r.score)).toEqual([1200]);
    expect(store.highScore()).toBe(1200);
  });

  it('보관 개수를 초과하면 오래된 기록부터 버린다', () => {
    const store = new RecordStore(new MemoryStorageAdapter());
    for (let i = 0; i < 60; i++) store.add(makeResult({ score: i, playedAt: i }));
    // gameConfig.records.keep = 50
    expect(store.list()).toHaveLength(50);
  });

  it('기록이 없으면 빈 배열과 null 을 반환한다', () => {
    const store = new RecordStore(new MemoryStorageAdapter());
    expect(store.list()).toEqual([]);
    expect(store.highScore()).toBeNull();
  });

  it('clear 로 모든 기록을 지운다', () => {
    const store = new RecordStore(new MemoryStorageAdapter());
    store.add(makeResult());
    store.clear();
    expect(store.list()).toEqual([]);
  });
});

describe('ThemeStore', () => {
  it('선택한 테마를 저장하고 다시 읽어 온다', () => {
    const store = new ThemeStore(new MemoryStorageAdapter());
    expect(store.get()).toBe('system');

    store.set('dark');
    expect(store.get()).toBe('dark');

    store.set('light');
    expect(store.get()).toBe('light');
  });

  it('명시적으로 고른 테마는 시스템 설정과 무관하게 그대로 적용된다', () => {
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });
});
