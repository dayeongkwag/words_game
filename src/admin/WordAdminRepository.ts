import type { WordEntry, WordFilters, WordStatus } from '@/types';

/**
 * 관리자용 단어 쓰기 인터페이스. (요구사항 45 — Phase 3 준비)
 *
 * ⚠️ 현재 Phase 에서는 **구현하지 않는다.** 인터페이스만 미리 정의해 두어,
 * 관리자 페이지를 붙일 때 게임 쪽 코드를 건드리지 않도록 한다.
 *
 * 읽기는 기존 `WordRepository` 를 그대로 쓰고, 쓰기만 이 인터페이스로 분리한다.
 * (게임 엔진은 이 인터페이스의 존재조차 알 필요가 없다)
 */
export interface WordAdminRepository {
  search(query: string, filters?: WordFilters): Promise<WordEntry[]>;

  create(word: Omit<WordEntry, 'id'>): Promise<WordEntry>;
  update(id: string, patch: Partial<WordEntry>): Promise<WordEntry>;
  remove(id: string): Promise<void>;

  setStatus(id: string, status: WordStatus): Promise<WordEntry>;
  setStatusBulk(ids: string[], status: WordStatus): Promise<WordEntry[]>;

  /** 검토가 필요한 단어 목록. */
  listPendingReview(limit?: number): Promise<ReviewCandidate[]>;
}

/** 관리자 "검토 필요" 목록의 항목. (요구사항 45) */
export interface ReviewCandidate {
  word: WordEntry;
  /** AI 또는 규칙이 내린 판단. Phase 5 에서 채워진다. */
  aiVerdict?: 'approve' | 'reject' | 'uncertain';
  /** 사람이 검토해야 하는 이유. */
  reviewReason?: string;
  /** 판단 신뢰도 0~1. */
  confidence?: number;
}
