import { defaultStorage, type StorageAdapter } from './StorageAdapter';

/**
 * 테마 저장. (요구사항 41)
 * `index.html` 의 인라인 스크립트가 같은 키를 읽어 초기 렌더 전에 테마를 적용한다.
 * 키를 바꾸면 그쪽도 함께 수정해야 한다.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_KEY = 'theme:v1';

export class ThemeStore {
  constructor(private readonly storage: StorageAdapter = defaultStorage) {}

  get(): ThemeMode {
    const saved = this.storage.get<{ mode: ThemeMode }>(THEME_KEY);
    const mode = saved?.mode;
    return mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system';
  }

  set(mode: ThemeMode): void {
    this.storage.set(THEME_KEY, { mode });
  }
}

export const themeStore = new ThemeStore();

/** 시스템 설정을 반영해 실제 적용할 테마를 계산한다. */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** <html data-theme="..."> 를 갱신한다. */
export function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#16141c' : '#faf8f4');
}
