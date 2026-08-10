import type { WordCategory, WordDifficulty, WordEntry, WordStatus } from '@/types';
import { isPuzzlePlayable, normalizeWord, toSyllables } from '@/utils/hangul';
import { MOCK_WORDS } from '../mock/mockWords';
import { BaseWordRepository } from './WordRepository';

/**
 * 프로젝트 루트의 `data/approved_words.json` 을 읽는 리포지토리. (요구사항 61)
 *
 * 파일이 아직 없어도 앱이 정상 동작해야 하므로, `import.meta.glob` 으로
 * "있으면 읽고 없으면 mock 으로 폴백" 하도록 구성했다.
 * 따라서 사용자는 파일을 프로젝트에 넣기만 하면 실제 DB 로 전환된다.
 *
 * 허용하는 JSON 형태:
 *   1) [ {...}, {...} ]
 *   2) { "version": "2026-08", "words": [ {...} ] }
 *   3) { "data": [ {...} ] }
 */
const DATA_MODULES = import.meta.glob('/data/approved_words.json', {
  import: 'default',
}) as Record<string, () => Promise<unknown>>;

export class JSONWordRepository extends BaseWordRepository {
  readonly kind = 'json';

  private resolvedVersion = 'json-unloaded';
  /** 실제 JSON 파일을 찾지 못해 mock 으로 폴백했는지 여부. */
  private usedFallback = false;

  protected async loadWords(): Promise<WordEntry[]> {
    const loader = Object.values(DATA_MODULES)[0];

    if (!loader) {
      this.usedFallback = true;
      this.resolvedVersion = `mock-${MOCK_WORDS.length}`;
      if (import.meta.env?.DEV) {
        console.info(
          '[JSONWordRepository] data/approved_words.json 을 찾지 못해 mock 단어로 대체합니다. ' +
            '파일을 추가하면 자동으로 실제 데이터를 사용합니다.',
        );
      }
      return MOCK_WORDS;
    }

    const raw = await loader();
    const { records, version } = unwrap(raw);
    const normalized = records.map(normalizeEntry).filter((w): w is WordEntry => w !== null);

    if (normalized.length === 0) {
      this.usedFallback = true;
      this.resolvedVersion = `mock-${MOCK_WORDS.length}`;
      console.warn('[JSONWordRepository] 유효한 단어가 없어 mock 단어로 대체합니다.');
      return MOCK_WORDS;
    }

    const dropped = records.length - normalized.length;
    if (dropped > 0 && import.meta.env?.DEV) {
      console.warn(`[JSONWordRepository] 퍼즐에 쓸 수 없는 단어 ${dropped}개를 제외했습니다.`);
    }

    this.resolvedVersion = version ?? `json-${normalized.length}`;
    return normalized;
  }

  protected async getVersion(): Promise<string> {
    await this.getAllWords();
    return this.resolvedVersion;
  }

  /** 실제 JSON 대신 mock 으로 폴백했는지. (개발용 배지 표시 등에 사용) */
  async isFallback(): Promise<boolean> {
    await this.getAllWords();
    return this.usedFallback;
  }
}

/** 여러 JSON 형태를 공통 형태로 벗겨 낸다. */
function unwrap(raw: unknown): { records: unknown[]; version?: string } {
  if (Array.isArray(raw)) return { records: raw };
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const version = typeof obj.version === 'string' ? obj.version : undefined;
    for (const key of ['words', 'data', 'items', 'entries']) {
      if (Array.isArray(obj[key])) return { records: obj[key] as unknown[], version };
    }
  }
  return { records: [] };
}

const VALID_STATUS: WordStatus[] = ['approved', 'pending', 'rejected'];

/**
 * 외부 JSON 레코드를 WordEntry 로 정규화한다.
 * 필드가 빠져 있어도 합리적인 기본값을 채우고, 퍼즐에 쓸 수 없는 단어는 null 을 돌려준다.
 */
function normalizeEntry(record: unknown, index: number): WordEntry | null {
  if (!record || typeof record !== 'object') return null;
  const r = record as Record<string, unknown>;

  const word = typeof r.word === 'string' ? r.word.trim() : '';
  if (!word) return null;

  const normalizedWord =
    typeof r.normalizedWord === 'string' && r.normalizedWord.trim()
      ? normalizeWord(r.normalizedWord.trim())
      : normalizeWord(word);

  // 격자에 놓으려면 모든 글자가 완성형 한글이어야 한다.
  if (!isPuzzlePlayable(normalizedWord)) return null;

  const difficultyRaw = Number(r.difficulty);
  const difficulty = (
    Number.isFinite(difficultyRaw) ? Math.min(5, Math.max(1, Math.round(difficultyRaw))) : 2
  ) as WordDifficulty;

  const status = VALID_STATUS.includes(r.status as WordStatus)
    ? (r.status as WordStatus)
    : 'approved';

  return {
    id: typeof r.id === 'string' && r.id ? r.id : `wd-${String(index + 1).padStart(6, '0')}`,
    word,
    normalizedWord,
    length: toSyllables(normalizedWord).length,
    category: (typeof r.category === 'string' ? r.category : '기타') as WordCategory,
    subcategory: typeof r.subcategory === 'string' ? r.subcategory : undefined,
    difficulty,
    definition: typeof r.definition === 'string' ? r.definition : '',
    isProperNoun: Boolean(r.isProperNoun),
    isSlang: Boolean(r.isSlang),
    isNeologism: Boolean(r.isNeologism),
    isTrendWord: Boolean(r.isTrendWord),
    isBrand: Boolean(r.isBrand),
    // 명시되지 않았으면 사용 가능한 것으로 본다.
    puzzleSuitable: r.puzzleSuitable === undefined ? true : Boolean(r.puzzleSuitable),
    status,
  };
}
