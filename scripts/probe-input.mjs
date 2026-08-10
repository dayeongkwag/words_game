/**
 * 실제 브라우저에서 격자 입력이 동작하는지 확인하는 진단 스크립트. (개발용)
 *
 *   node scripts/probe-input.mjs [url]
 *
 * 코드만 읽어서는 알 수 없는 것들을 실제로 측정한다.
 *  - 입력창이 현재 칸과 정확히 겹치는가
 *  - 칸을 눌렀을 때 포커스가 입력창으로 가는가
 *  - 한글 조합/확정이 격자에 반영되는가
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5174/';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '새 퍼즐 풀기' }).click();
await page.waitForSelector('#puzzle-grid', { timeout: 15000 });
console.log('=== 1. 퍼즐 생성 완료 ===');

/** 입력창과 현재 커서 칸의 위치를 재서 비교한다. */
const measure = () =>
  page.evaluate(() => {
    const input = document.querySelector('.grid__input');
    const slot = document.querySelector('.grid__input-slot');
    const cursorCell = document.querySelector('#puzzle-grid button[aria-current="true"]');
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const style = input ? getComputedStyle(input) : null;
    return {
      input: box(input),
      slot: box(slot),
      cursorCell: box(cursorCell),
      cursorAt: cursorCell ? `${cursorCell.dataset.row},${cursorCell.dataset.col}` : null,
      css: style && {
        color: style.color,
        opacity: style.opacity,
        visibility: style.visibility,
        fontSize: style.fontSize,
        zIndex: style.zIndex,
      },
      focusedIsInput: document.activeElement === input,
      activeElement: document.activeElement?.className || document.activeElement?.tagName,
    };
  });

console.log('\n=== 2. 초기 상태 ===');
let m = await measure();
console.log(JSON.stringify(m, null, 2));
report(m);

console.log('\n=== 3. 다른 칸 클릭 (force) ===');
// 입력창이 현재 칸을 덮고 있으므로, 다른 칸을 골라 클릭한다.
const otherCell = page.locator('#puzzle-grid button.cell').nth(3);
const otherAt = await otherCell.evaluate((el) => `${el.dataset.row},${el.dataset.col}`);
await otherCell.click({ force: true });
await page.waitForTimeout(200);
m = await measure();
console.log(`클릭한 칸: ${otherAt} / 이동 후 커서: ${m.cursorAt} / 포커스=입력창: ${m.focusedIsInput}`);
report(m);

console.log('\n=== 4. 한글 조합 시뮬레이션 ===');
await page.evaluate(() => {
  const input = document.querySelector('.grid__input');
  input.focus();
  const compose = (type, data) =>
    input.dispatchEvent(new CompositionEvent(type, { data, bubbles: true }));
  const type = (data) => input.dispatchEvent(new InputEvent('input', { data, bubbles: true }));

  compose('compositionstart', '');
  input.value = 'ㄱ';
  compose('compositionupdate', 'ㄱ');
  type('ㄱ');
  input.value = '가';
  compose('compositionupdate', '가');
  type('가');
});
await page.waitForTimeout(200);

const composing = await page.evaluate(() => {
  const input = document.querySelector('.grid__input');
  const cursorCell = document.querySelector('#puzzle-grid button[aria-current="true"]');
  return {
    inputValue: input?.value,
    cellShows: cursorCell?.querySelector('.cell__letter')?.textContent ?? '',
  };
});
console.log(`조합 중 → 입력창="${composing.inputValue}" / 칸 표시="${composing.cellShows}"`);
console.log(
  composing.inputValue === '가'
    ? '  OK: 조합 글자가 입력창에 살아 있음 (화면에는 칸 위치에 보임)'
    : '  문제: 입력창에 조합 글자가 없음',
);

console.log('\n=== 5. 조합 확정 ===');
await page.evaluate(() => {
  const input = document.querySelector('.grid__input');
  input.dispatchEvent(new CompositionEvent('compositionend', { data: '가', bubbles: true }));
});
await page.waitForTimeout(300);

const committed = await page.evaluate(() => ({
  filled: [...document.querySelectorAll('#puzzle-grid button.cell')]
    .map((el) => ({ at: `${el.dataset.row},${el.dataset.col}`, ch: el.querySelector('.cell__letter')?.textContent }))
    .filter((c) => c.ch),
  inputValue: document.querySelector('.grid__input')?.value,
}));
console.log(`격자에 채워진 글자: ${JSON.stringify(committed.filled)}`);
console.log(`입력창 비워짐: ${committed.inputValue === ''}`);
console.log(
  committed.filled.length > 0 ? '  OK: 격자에 글자가 들어감' : '  문제: 격자가 그대로임',
);

console.log('\n=== 6. 커서가 다음 칸으로 이동했는가 ===');
m = await measure();
console.log(`커서: ${m.cursorAt}`);
report(m);

console.log('\n=== 7. 실제 키보드로 연속 입력 ===');
const target = page.locator('#puzzle-grid button.cell').nth(5);
const targetAt = await target.evaluate((el) => `${el.dataset.row},${el.dataset.col}`);
await target.click({ force: true });
await page.waitForTimeout(150);
await page.keyboard.insertText('사');
await page.waitForTimeout(120);
await page.keyboard.insertText('회');
await page.waitForTimeout(250);

const typed = await page.evaluate(() => ({
  filled: [...document.querySelectorAll('#puzzle-grid button.cell')]
    .map((el) => ({ at: `${el.dataset.row},${el.dataset.col}`, ch: el.querySelector('.cell__letter')?.textContent }))
    .filter((c) => c.ch),
  cursorAt: (() => {
    const el = document.querySelector('#puzzle-grid button[aria-current="true"]');
    return el ? `${el.dataset.row},${el.dataset.col}` : null;
  })(),
}));
console.log(`시작 칸 ${targetAt} 에서 '사회' 입력`);
console.log(`격자: ${JSON.stringify(typed.filled)}`);
console.log(`커서: ${typed.cursorAt}`);
console.log(
  typed.filled.length >= 2 ? '  OK: 두 글자가 연속으로 들어감' : '  문제: 글자가 제대로 안 들어감',
);

console.log('\n=== 8. 한 글자만 치고 다른 칸으로 이동 (버려지지 않는지) ===');
const cellA = page.locator('#puzzle-grid button.cell').nth(8);
const atA = await cellA.evaluate((el) => `${el.dataset.row},${el.dataset.col}`);
await cellA.click({ force: true });
await page.waitForTimeout(150);
// 조합 중 상태로 남겨 둔 채 다른 칸을 누른다.
await page.evaluate(() => {
  const input = document.querySelector('.grid__input');
  input.focus();
  input.dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }));
  input.value = '물';
  input.dispatchEvent(new InputEvent('input', { data: '물', bubbles: true }));
});
await page.waitForTimeout(120);
await page.locator('#puzzle-grid button.cell').nth(12).click({ force: true });
await page.waitForTimeout(250);

const kept = await page.evaluate(
  (at) =>
    [...document.querySelectorAll('#puzzle-grid button.cell')]
      .find((el) => `${el.dataset.row},${el.dataset.col}` === at)
      ?.querySelector('.cell__letter')?.textContent,
  atA,
);
console.log(`칸 ${atA} 에 '물' 남아 있는가: ${JSON.stringify(kept)}`);
console.log(kept === '물' ? '  OK: 조합 중이던 글자가 확정됨' : '  문제: 글자가 버려짐');

if (logs.length > 0) {
  console.log('\n=== 브라우저 콘솔 ===');
  for (const line of logs.slice(0, 15)) console.log(line);
}

await page.screenshot({ path: 'dist/probe.png' });
console.log('\n스크린샷: dist/probe.png');
await browser.close();

function report(m) {
  if (!m.input || !m.cursorCell) {
    console.log('  !! 입력창 또는 커서 칸을 찾지 못함');
    return;
  }
  const dx = Math.abs(m.input.x - m.cursorCell.x);
  const dy = Math.abs(m.input.y - m.cursorCell.y);
  const dw = Math.abs(m.input.w - m.cursorCell.w);
  const dh = Math.abs(m.input.h - m.cursorCell.h);
  const ok = dx <= 2 && dy <= 2 && dw <= 2 && dh <= 2;
  console.log(
    `  입력창 vs 칸 → ${ok ? 'OK 정확히 겹침' : `어긋남 (dx=${dx} dy=${dy} dw=${dw} dh=${dh})`}`,
  );
}
