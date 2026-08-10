/**
 * 실기기 진단용 로그. `?debug=1` 로 접속했을 때만 동작한다.
 *
 * 모바일 브라우저는 개발자 도구를 붙이기 번거로워서, 화면 위에 직접
 * 이벤트 흐름을 찍어 보기 위한 최소한의 장치다.
 * 평소에는 `isDebugEnabled()` 가 false 라 아무 비용도 발생하지 않는다.
 */

export interface DebugEntry {
  id: number;
  at: number;
  message: string;
}

let enabled: boolean | null = null;
let nextId = 1;
const entries: DebugEntry[] = [];
const listeners = new Set<(entries: DebugEntry[]) => void>();

const MAX_ENTRIES = 40;

/** `?debug=1` 로 명시적으로 켰는지. (켜면 패널이 펼쳐진 채로 시작한다) */
export function isDebugForced(): boolean {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === '1'
  );
}

/**
 * 개발 서버에서는 항상 켠다. 실기기 문제를 확인할 때 URL 에 파라미터를 붙이는
 * 번거로움을 없애기 위해서다. 프로덕션 빌드에서는 완전히 꺼진다.
 */
export function isDebugEnabled(): boolean {
  if (enabled === null) {
    enabled =
      typeof window !== 'undefined' && (Boolean(import.meta.env?.DEV) || isDebugForced());
  }
  return enabled;
}

export function logDebug(message: string): void {
  if (!isDebugEnabled()) return;
  entries.unshift({ id: nextId++, at: Date.now(), message });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  const snapshot = entries.slice();
  for (const listener of listeners) listener(snapshot);
}

export function subscribeDebug(listener: (entries: DebugEntry[]) => void): () => void {
  listeners.add(listener);
  listener(entries.slice());
  return () => listeners.delete(listener);
}

export function clearDebug(): void {
  entries.length = 0;
  for (const listener of listeners) listener([]);
}
