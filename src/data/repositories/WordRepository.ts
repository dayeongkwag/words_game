import type { WordCategory, WordDifficulty, WordEntry, WordFilters, WordSourceInfo } from '@/types';
import type { Rng } from '@/utils/random';

/**
 * 단어 데이터 접근 인터페이스. (요구사항 3·6)
 *
 * 게임 엔진(PuzzleGenerator, HintSystem 등)은 오직 이 인터페이스만 알고 있으며,
 * 뒤에 JSON / Supabase / API 중 무엇이 있는지 알지 못한다.
 *
 *   Game Engine → WordRepository → (JSON | Supabase | API)
 *
 * 모든 메서드가 비동기인 이유는, 향후 네트워크 기반 구현으로 교체할 때
 * 호출부를 수정하지 않기 위해서다.
 */
export interface WordRepository {
  /** 구현체 종류. 'mock' | 'json' | 'supabase' | 'api' ... */
  readonly kind: string;

  /** 데이터 소스 메타데이터(버전, 총 개수). 공유 링크 호환성 판단에 쓰인다. */
  getSourceInfo(): Promise<WordSourceInfo>;

  /** 전체 단어. (필터 없음) */
  getAllWords(): Promise<WordEntry[]>;

  /**
   * 무작위 단어 N개.
   * @param rng 시드 기반 RNG. 넘기면 결과가 결정론적으로 재현된다.
   */
  getRandomWords(count: number, filters?: WordFilters, rng?: Rng): Promise<WordEntry[]>;

  getWordsByDifficulty(difficulty: WordDifficulty): Promise<WordEntry[]>;

  getWordsByCategory(category: WordCategory): Promise<WordEntry[]>;

  getWordsByLength(length: number): Promise<WordEntry[]>;

  /** 퍼즐에 사용 가능한 단어(승인 + puzzleSuitable + 필터). */
  getSuitableWords(filters?: WordFilters): Promise<WordEntry[]>;

  getWordById(id: string): Promise<WordEntry | null>;

  /** 표기 단어 또는 정규화 단어로 조회. */
  getWordByText(word: string): Promise<WordEntry | null>;

  /** 캐시를 비운다. (관리자에서 데이터 갱신 후 호출) */
  invalidate(): void;
}

/**
 * 인메모리 필터링을 제공하는 공통 베이스.
 *
 * 새 데이터 소스를 붙일 때는 `loadWords()` 와 `kind`, `getVersion()` 만 구현하면 된다.
 * Supabase 처럼 서버에서 필터링하는 편이 나은 구현체는 개별 메서드를 override 하면 된다.
 */
export abstract class BaseWordRepository implements WordRepository {
  abstract readonly kind: string;

  private cache: WordEntry[] | null = null;
  private byId: Map<string, WordEntry> | null = null;
  private byText: Map<string, WordEntry> | null = null;
  private loading: Promise<WordEntry[]> | null = null;

  /** 실제 데이터 로딩. 구현체가 채운다. */
  protected abstract loadWords(): Promise<WordEntry[]>;

  /** 데이터셋 버전 문자열. 기본값은 단어 개수 기반. */
  protected async getVersion(): Promise<string> {
    const words = await this.ensureLoaded();
    return `${this.kind}-${words.length}`;
  }

  invalidate(): void {
    this.cache = null;
    this.byId = null;
    this.byText = null;
    this.loading = null;
  }

  protected async ensureLoaded(): Promise<WordEntry[]> {
    if (this.cache) return this.cache;
    if (!this.loading) {
      this.loading = this.loadWords().then((words) => {
        // 데이터 소스의 반환 순서에 관계없이 항상 동일한 순서를 보장한다.
        // 시드 기반 퍼즐 재현이 이 안정적 정렬에 의존한다.
        const sorted = words.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        this.cache = sorted;
        this.byId = new Map(sorted.map((w) => [w.id, w]));
        this.byText = new Map();
        for (const w of sorted) {
          this.byText.set(w.word, w);
          this.byText.set(w.normalizedWord, w);
        }
        return sorted;
      });
    }
    return this.loading;
  }

  async getSourceInfo(): Promise<WordSourceInfo> {
    const words = await this.ensureLoaded();
    return { kind: this.kind, version: await this.getVersion(), totalCount: words.length };
  }

  async getAllWords(): Promise<WordEntry[]> {
    return this.ensureLoaded();
  }

  async getSuitableWords(filters: WordFilters = {}): Promise<WordEntry[]> {
    const words = await this.ensureLoaded();
    return words.filter((w) => matchesFilters(w, filters));
  }

  async getRandomWords(count: number, filters: WordFilters = {}, rng?: Rng): Promise<WordEntry[]> {
    const pool = await this.getSuitableWords(filters);
    if (count >= pool.length) return rng ? rng.shuffle(pool) : pool.slice();
    const shuffled = rng
      ? rng.shuffle(pool)
      : pool.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  async getWordsByDifficulty(difficulty: WordDifficulty): Promise<WordEntry[]> {
    return this.getSuitableWords({ difficulties: [difficulty] });
  }

  async getWordsByCategory(category: WordCategory): Promise<WordEntry[]> {
    return this.getSuitableWords({ categories: [category] });
  }

  async getWordsByLength(length: number): Promise<WordEntry[]> {
    return this.getSuitableWords({ length });
  }

  async getWordById(id: string): Promise<WordEntry | null> {
    await this.ensureLoaded();
    return this.byId?.get(id) ?? null;
  }

  async getWordByText(word: string): Promise<WordEntry | null> {
    await this.ensureLoaded();
    return this.byText?.get(word) ?? null;
  }
}

/** 단어 하나가 필터를 통과하는지 판정한다. (모든 조건 AND) */
export function matchesFilters(word: WordEntry, filters: WordFilters): boolean {
  const {
    statuses = ['approved'],
    puzzleSuitableOnly = true,
    allowProperNoun = true,
    allowNeologism = true,
    allowTrendWord = true,
    allowSlang = true,
    allowBrand = true,
  } = filters;

  if (!statuses.includes(word.status)) return false;
  if (puzzleSuitableOnly && !word.puzzleSuitable) return false;

  if (!allowProperNoun && word.isProperNoun) return false;
  if (!allowNeologism && word.isNeologism) return false;
  if (!allowTrendWord && word.isTrendWord) return false;
  if (!allowSlang && word.isSlang) return false;
  if (!allowBrand && word.isBrand) return false;

  if (filters.difficulties && !filters.difficulties.includes(word.difficulty)) return false;
  if (filters.minDifficulty != null && word.difficulty < filters.minDifficulty) return false;
  if (filters.maxDifficulty != null && word.difficulty > filters.maxDifficulty) return false;

  if (filters.categories && !filters.categories.includes(word.category)) return false;
  if (filters.excludeCategories?.includes(word.category)) return false;

  if (filters.length != null && word.length !== filters.length) return false;
  if (filters.minLength != null && word.length < filters.minLength) return false;
  if (filters.maxLength != null && word.length > filters.maxLength) return false;

  if (filters.excludeIds?.includes(word.id)) return false;

  return true;
}
