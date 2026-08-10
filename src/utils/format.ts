/** 경과 시간(ms)을 "MM:SS" 형태로 포맷. 1시간을 넘으면 "H:MM:SS". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 점수를 천 단위 구분자와 함께 포맷. */
export function formatScore(score: number): string {
  return Math.round(score).toLocaleString('ko-KR');
}

/** epoch ms → "2026. 8. 10." */
export function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}
