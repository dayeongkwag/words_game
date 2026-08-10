import type { WordEntry } from '@/types';
import { MOCK_WORDS } from '../mock/mockWords';
import { BaseWordRepository } from './WordRepository';

/**
 * 개발/테스트용 리포지토리. (요구사항 61: 실제 DB 연결 후에도 테스트용으로 유지)
 */
export class MockWordRepository extends BaseWordRepository {
  readonly kind = 'mock';

  constructor(private readonly words: WordEntry[] = MOCK_WORDS) {
    super();
  }

  protected async loadWords(): Promise<WordEntry[]> {
    return this.words;
  }

  protected async getVersion(): Promise<string> {
    return `mock-${this.words.length}`;
  }
}
