import type { CategoryMixConfig } from '@/config';
import type { GameConfig } from '@/config';
import type { ScoringConfig } from '@/config';

/**
 * 관리자 설정 스키마. (요구사항 45·46 — Phase 3 준비)
 *
 * ⚠️ 관리자 페이지 UI 는 아직 구현하지 않는다. 여기서는 "무엇을 바꿀 수 있는지"의
 * 구조만 정의해 둔다. Phase 3 에서 이 객체를 저장/불러오기만 붙이면 되고,
 * 실제 적용은 기존 `applyGameConfigOverrides()` 등에 그대로 넘기면 된다.
 */
export interface AdminSettings {
  /** 게임 규칙 override (오답 한도, 힌트 횟수/차감 점수, 단어 수 등) */
  game?: DeepPartial<GameConfig>;
  /** 점수 계수 override */
  scoring?: Partial<ScoringConfig>;
  /** 카테고리 비율 및 고유명사/신조어 상한 override */
  categoryMix?: DeepPartial<CategoryMixConfig>;
  /** AI 단어 업데이트 설정 (Phase 5) */
  ai: AiAutoApprovalSettings;
}

/**
 * AI 자동 승인 설정. (요구사항 46)
 * ⚠️ 실제 자동 승인 기능은 현재 구현하지 않는다. 설정 구조만 확장 가능하게 준비한다.
 */
export interface AiAutoApprovalSettings {
  /** AI 단어 수집/판정 기능 사용 여부. 현재는 항상 false. */
  enabled: boolean;
  /**
   * 자동 승인 비율(0~100).
   * AI 가 가져온 후보 중 신뢰도 상위 N% 를 자동 승인하고 나머지는 검토 대기로 보낸다.
   */
  autoApprovePercent: number;
  /** 이 신뢰도 미만은 비율과 무관하게 반드시 사람이 검토한다. */
  minConfidenceForAutoApprove: number;
  /** 한 번의 업데이트에서 가져올 최대 후보 수. */
  maxCandidatesPerRun: number;
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  ai: {
    enabled: false,
    autoApprovePercent: 80,
    minConfidenceForAutoApprove: 0.75,
    maxCandidatesPerRun: 200,
  },
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
