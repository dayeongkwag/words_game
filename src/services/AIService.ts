import type { WordEntry } from '@/types';

/**
 * AI 단어 업데이트 서비스 인터페이스. (요구사항 47·48 — Phase 5 준비)
 *
 * ⚠️ 현재 Phase 에서는 **구현하지 않으며, 어디에서도 호출하지 않는다.**
 *    게임은 로컬 단어 DB만으로 완전히 동작한다.
 *
 * 설계 원칙
 *  - AI 는 게임 핵심 로직(PuzzleGenerator / Scoring / HintSystem / GameState)과
 *    절대 직접 결합되지 않는다. 오직 단어 DB를 채우는 오프라인 파이프라인으로만 쓰인다.
 *  - 게임 플레이 중에는 어떤 경우에도 AI API 를 호출하지 않는다.
 *  - API 키는 프론트엔드에 두지 않는다. (요구사항 50)
 *      frontend → backend / server function → AI API
 *    이 인터페이스의 구현체는 반드시 자체 백엔드 엔드포인트를 호출해야 한다.
 */
export interface AIService {
  /** 최신 단어 후보 수집 */
  collectCandidates(options: { limit: number; hint?: string }): Promise<WordCandidate[]>;

  /** 단어 검증 + 카테고리 분류 + 뜻 생성 + 퍼즐 적합성 판단 */
  evaluate(candidates: WordCandidate[]): Promise<WordEvaluation[]>;
}

export interface WordCandidate {
  word: string;
  /** 어디에서 수집했는지. */
  source?: string;
}

export interface WordEvaluation {
  candidate: WordCandidate;
  /** 승인 후보로 만들어진 단어 레코드. */
  proposed: Omit<WordEntry, 'id' | 'status'>;
  /** 0~1. 관리자 설정의 자동 승인 비율/임계값과 함께 사용된다. */
  confidence: number;
  verdict: 'approve' | 'reject' | 'uncertain';
  /** 사람이 검토해야 하는 이유. */
  reviewReason?: string;
}
