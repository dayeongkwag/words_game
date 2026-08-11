/**
 * 단어 ID 안정성 점검. (개발용)
 *
 *   npx vite-node scripts/check-ids.ts
 *
 * 단어 ID 는 배열 순번으로 만들어지므로, 배열 **중간에** 단어를 끼워 넣으면
 * 그 뒤 단어들의 ID 가 전부 밀린다. 그러면 과거 공유 링크가 다른 퍼즐을 가리키게 된다.
 * 확장할 때는 반드시 배열 끝에만 추가해야 하며, 이 스크립트로 확인한다.
 */
import { MOCK_WORDS } from '../src/data/mock/mockWords';

/**
 * 기준점. 여기 적힌 ID 는 앞으로 절대 다른 단어를 가리키면 안 된다.
 * 새 단어를 배열 끝에만 추가하면 이 값들은 영원히 유지된다.
 * `wd-000588` 은 2차 확장 직전의 마지막 단어라, 이것이 그대로면
 * 그 앞의 587개도 전부 밀리지 않았다는 뜻이다.
 */
const ANCHORS: [string, string][] = [
  ['wd-000001', '가족'],
  ['wd-000050', '사진'],
  ['wd-000150', '관찰력'],
  ['wd-000214', '출판사'],
  ['wd-000400', '승리'],
  ['wd-000588', '소셜미디어'],
];

let failed = 0;
for (const [id, expected] of ANCHORS) {
  const found = MOCK_WORDS.find((w) => w.id === id);
  const ok = found?.word === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : '문제'} ${id} = ${JSON.stringify(found?.word)} (기대 ${JSON.stringify(expected)})`);
}

console.log(`\n총 ${MOCK_WORDS.length}개`);
console.log(failed === 0 ? 'ID 안정성 OK — 기존 단어의 ID 가 밀리지 않았다' : `문제 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
