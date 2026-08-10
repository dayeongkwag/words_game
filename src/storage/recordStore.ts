import { getGameConfig } from '@/config';
import type { GameResult, PlayRecord } from '@/types';
import { defaultStorage, type StorageAdapter } from './StorageAdapter';

/**
 * 개인 기록 저장. (요구사항 33·34)
 * 로그인 없이 브라우저에만 저장하며, 저장 로직은 UI 와 완전히 분리되어 있다.
 */

const RECORDS_KEY = 'records:v1';

export class RecordStore {
  constructor(private readonly storage: StorageAdapter = defaultStorage) {}

  /** 최근 기록. 최신순으로 반환한다. */
  list(limit?: number): PlayRecord[] {
    const records = this.storage.get<PlayRecord[]>(RECORDS_KEY) ?? [];
    if (!Array.isArray(records)) return [];
    const sorted = records.slice().sort((a, b) => b.playedAt - a.playedAt);
    return limit === undefined ? sorted : sorted.slice(0, limit);
  }

  /** 점수 높은 순 기록. */
  best(limit = 5): PlayRecord[] {
    return this.list()
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  add(result: GameResult): PlayRecord {
    const config = getGameConfig();
    const record: PlayRecord = { ...result, recordId: createRecordId(result) };
    const next = [record, ...this.list()].slice(0, config.records.keep);
    this.storage.set(RECORDS_KEY, next);
    return record;
  }

  clear(): void {
    this.storage.remove(RECORDS_KEY);
  }

  /** 최고 점수. 기록이 없으면 null. */
  highScore(): number | null {
    const records = this.list();
    if (records.length === 0) return null;
    return Math.max(...records.map((r) => r.score));
  }
}

function createRecordId(result: GameResult): string {
  return `${result.playedAt.toString(36)}-${result.puzzleId}`;
}

export const recordStore = new RecordStore();
