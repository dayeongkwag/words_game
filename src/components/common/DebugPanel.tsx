import { useEffect, useState } from 'react';
import {
  clearDebug,
  isDebugEnabled,
  isDebugForced,
  logDebug,
  subscribeDebug,
  type DebugEntry,
} from '@/utils/debugLog';

/**
 * 실기기 진단 패널. `?debug=1` 로 접속했을 때만 나타난다. (개발용)
 *
 * 모바일에서 "키보드가 안 열린다 / 글자가 안 쳐진다" 같은 문제는
 * 어느 단계에서 끊기는지 봐야 알 수 있어서, 이벤트 흐름을 화면에 직접 찍는다.
 */
export function DebugPanel() {
  const [entries, setEntries] = useState<DebugEntry[]>([]);
  // 개발 서버에서 자동으로 켜질 때는 게임을 가리지 않도록 접어 둔다.
  const [open, setOpen] = useState(() => isDebugForced());

  useEffect(() => {
    if (!isDebugEnabled()) return;
    return subscribeDebug(setEntries);
  }, []);

  // 포커스가 어디에 있는지는 원인 파악의 핵심이라 주기적으로 확인한다.
  useEffect(() => {
    if (!isDebugEnabled()) return;
    let last = '';
    const id = window.setInterval(() => {
      const el = document.activeElement;
      const name = el ? `${el.tagName.toLowerCase()}.${el.className || '-'}` : 'none';
      if (name !== last) {
        last = name;
        logDebug(`activeElement → ${name}`);
      }
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  if (!isDebugEnabled()) return null;

  return (
    <div className={`debug ${open ? '' : 'debug--collapsed'}`}>
      <div className="debug__bar">
        <strong>진단</strong>
        <button type="button" onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : '펼치기'}
        </button>
        <button type="button" onClick={clearDebug}>
          지우기
        </button>
      </div>
      {open && (
        <ol className="debug__list">
          {entries.map((entry) => (
            <li key={entry.id}>{entry.message}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
