import type { GameResult } from '@/types';
import { formatDuration } from '@/utils/format';

/**
 * 공유 문구와 링크 정책. (요구사항 35·36·37·58)
 */
export interface ShareConfig {
  /** 게임 타이틀. 공유 문구/이미지에 사용. */
  title: string;
  /**
   * 공유 링크 방식.
   * - 'seed'     : puzzleId(seed) 만 링크에 담아 재생성한다. 링크가 짧다.
   * - 'snapshot' : 배치 정보 전체를 링크에 담는다. 단어 DB가 바뀌어도 재현된다.
   */
  linkMode: 'seed' | 'snapshot';
  /** 링크에 쓰이는 쿼리 파라미터 이름. */
  params: {
    seed: string;
    snapshot: string;
    generatorVersion: string;
    dictVersion: string;
    checksum: string;
  };
  /** 공유 문구 템플릿. */
  buildMessage: (result: GameResult) => string;
}

export const DEFAULT_SHARE_CONFIG: ShareConfig = {
  title: '낱말퍼즐',
  linkMode: 'seed',
  params: {
    seed: 'p',
    snapshot: 'pz',
    generatorVersion: 'g',
    dictVersion: 'd',
    checksum: 'c',
  },
  buildMessage: (result) => {
    const lines = [
      `🧩 오늘의 낱말퍼즐을 풀었어요!`,
      ``,
      `점수: ${result.score.toLocaleString('ko-KR')}점`,
      `시간: ${formatDuration(result.elapsedMs)}`,
      `오답: ${result.mistakes}회`,
    ];
    if (result.hintsUsed > 0) lines.push(`힌트: ${result.hintsUsed}회`);
    lines.push(``, `나와 같은 퍼즐에 도전해보세요!`);
    return lines.join('\n');
  },
};

let current: ShareConfig = DEFAULT_SHARE_CONFIG;

export function getShareConfig(): ShareConfig {
  return current;
}

export function resetShareConfig(): void {
  current = DEFAULT_SHARE_CONFIG;
}
