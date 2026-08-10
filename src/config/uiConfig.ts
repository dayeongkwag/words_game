/**
 * UI 동작/애니메이션 관련 수치. (요구사항 42·44·58)
 * 색상과 폰트는 CSS 변수(`src/styles/tokens.css`)에서 관리한다.
 */
export const UI_CONFIG = {
  grid: {
    /** 칸 최소 크기(px). 모바일에서 손가락으로 누르기 쉬운 크기를 보장한다. */
    minCellPx: 34,
    /** 칸 최대 크기(px). 데스크톱에서 지나치게 커지지 않게 한다. */
    maxCellPx: 56,
    /** 격자 주변 여백(px). */
    gapPx: 2,
  },

  animation: {
    /** 오답 흔들림 지속시간(ms). */
    shakeMs: 420,
    /** 정답 성공 애니메이션 지속시간(ms). */
    solveMs: 520,
    /** 화면 전환 지속시간(ms). */
    screenMs: 220,
    /**
     * prefers-reduced-motion 을 존중한다. CSS 에서도 처리하지만
     * JS 타이머 길이도 함께 줄이기 위한 배수.
     */
    reducedMotionScale: 0.01,
  },

  clue: {
    /** 데스크톱에서 힌트 목록을 좌우로 배치할 최소 화면 너비(px). */
    sideBySideMinWidth: 900,
  },

  toast: {
    durationMs: 2200,
  },
} as const;
