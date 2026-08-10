import { useCallback, useEffect, useState } from 'react';
import { applyTheme, resolveTheme, themeStore, type ResolvedTheme, type ThemeMode } from '@/storage';

/**
 * 라이트/다크 모드. (요구사항 41)
 * - 사용자가 직접 전환 가능
 * - 선택하지 않았으면 시스템 설정을 따라가고, 시스템이 바뀌면 즉시 반영
 * - 선택은 브라우저에 저장되어 다음 방문에도 유지
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => themeStore.get());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(themeStore.get()));

  useEffect(() => {
    const next = resolveTheme(mode);
    setResolved(next);
    applyTheme(next);
    themeStore.set(mode);
  }, [mode]);

  // 'system' 인 동안에는 OS 설정 변경을 따라간다.
  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next: ResolvedTheme = media.matches ? 'dark' : 'light';
      setResolved(next);
      applyTheme(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [mode]);

  /** 라이트 ↔ 다크 토글. 'system' 상태였다면 현재 보이는 테마의 반대로 고정한다. */
  const toggle = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved]);

  return { mode, resolved, setMode, toggle };
}
