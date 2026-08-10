/**
 * 개발용 단어 데이터 점검 스크립트.
 * 중복·비한글·길이 분포·카테고리 분포를 확인한다.
 *
 *   npx vite-node scripts/check-words.ts
 */
import { MOCK_WORDS } from '../src/data/mock/mockWords';
import { isPuzzlePlayable } from '../src/utils/hangul';

const words = MOCK_WORDS;
console.log(`총 단어: ${words.length}개`);

const seen = new Map<string, number>();
for (const w of words) seen.set(w.normalizedWord, (seen.get(w.normalizedWord) ?? 0) + 1);
const duplicates = [...seen].filter(([, count]) => count > 1).map(([word]) => word);
console.log(`중복 단어: ${duplicates.length > 0 ? duplicates.join(', ') : '없음'}`);

const ids = new Set(words.map((w) => w.id));
console.log(`중복 ID: ${ids.size === words.length ? '없음' : '있음!'}`);

const broken = words.filter((w) => !isPuzzlePlayable(w.normalizedWord));
console.log(`퍼즐 불가 단어: ${broken.length > 0 ? broken.map((w) => w.word).join(', ') : '없음'}`);

const byLength: Record<number, number> = {};
for (const w of words) byLength[w.length] = (byLength[w.length] ?? 0) + 1;
console.log(
  '길이별:',
  Object.entries(byLength)
    .map(([len, count]) => `${len}글자 ${count}개`)
    .join(' · '),
);

const byDifficulty: Record<number, number> = {};
for (const w of words) byDifficulty[w.difficulty] = (byDifficulty[w.difficulty] ?? 0) + 1;
console.log(
  '난이도별:',
  Object.entries(byDifficulty)
    .map(([d, count]) => `${d} ${count}개`)
    .join(' · '),
);

const flags = {
  고유명사: words.filter((w) => w.isProperNoun).length,
  신조어: words.filter((w) => w.isNeologism).length,
  유행어: words.filter((w) => w.isTrendWord).length,
};
console.log('성격별:', JSON.stringify(flags));
