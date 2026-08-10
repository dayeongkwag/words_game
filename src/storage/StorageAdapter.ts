/**
 * 저장소 추상화. (요구사항 33·49)
 *
 * 지금은 localStorage 를 쓰지만, 향후 로그인/Supabase 를 붙일 때
 * 이 인터페이스를 구현한 어댑터로 갈아 끼우기만 하면 되도록 분리한다.
 */
export interface StorageAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

/** 브라우저 localStorage 어댑터. 사용할 수 없는 환경에서는 조용히 무시한다. */
export class LocalStorageAdapter implements StorageAdapter {
  private available: boolean;

  constructor(private readonly prefix = 'nalmal:') {
    this.available = detectLocalStorage();
  }

  get<T>(key: string): T | null {
    if (!this.available) return null;
    try {
      const raw = window.localStorage.getItem(this.prefix + key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    if (!this.available) return;
    try {
      window.localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      // 저장 용량 초과 등은 조용히 무시한다. 기록은 부가 기능이다.
    }
  }

  remove(key: string): void {
    if (!this.available) return;
    try {
      window.localStorage.removeItem(this.prefix + key);
    } catch {
      // 무시
    }
  }
}

/** 테스트/SSR 용 인메모리 어댑터. */
export class MemoryStorageAdapter implements StorageAdapter {
  private readonly store = new Map<string, string>();

  get<T>(key: string): T | null {
    const raw = this.store.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, JSON.stringify(value));
  }

  remove(key: string): void {
    this.store.delete(key);
  }
}

function detectLocalStorage(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probe = '__nalmal_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** 앱 전역에서 쓰는 기본 어댑터. */
export const defaultStorage: StorageAdapter =
  typeof window === 'undefined' ? new MemoryStorageAdapter() : new LocalStorageAdapter();
