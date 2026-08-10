/**
 * 실제 브라우저에서 격자 입력이 동작하는지 확인하는 진단 스크립트. (개발용)
 *
 *   node scripts/probe-input.mjs [url]
 *
 * 코드만 읽어서는 알 수 없는 것들을 실제 브라우저에서 측정한다.
 *  - 입력창이 현재 칸과 정확히 겹치는가
 *  - 칸을 눌렀을 때 포커스가 입력창으로 가는가
 *  - 한글이 격자에 들어가는가 (조합 이벤트가 오는 경우 / 오지 않는 iOS 방식 모두)
 *
 * 검사마다 새 게임으로 시작한다. 한 판에서 이어서 하면 틀린 입력이 쌓여
 * 오답 한도로 게임이 끝나 버려 결과가 실행마다 달라진다.
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5174/';
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'OK  ' : '문제'} ${label}${detail ? ` — ${detail}` : ''}`);
};

/** 새 게임을 시작하고 격자가 준비될 때까지 기다린다. */
async function newGame() {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '새 퍼즐 풀기' }).click();
  await page.waitForSelector('#puzzle-grid', { timeout: 15000 });
}

/** 아직 비어 있는 칸들의 좌표. */
const emptyCells = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('#puzzle-grid button.cell')]
      .filter((el) => !el.querySelector('.cell__letter')?.textContent)
      .map((el) => `${el.dataset.row},${el.dataset.col}`),
  );

const cellAt = (at) => {
  const [row, col] = at.split(',');
  return page.locator(`#puzzle-grid [data-row="${row}"][data-col="${col}"]`);
};

const letterAt = (at) =>
  page.evaluate((target) => {
    const [row, col] = target.split(',');
    return document
      .querySelector(`#puzzle-grid [data-row="${row}"][data-col="${col}"] .cell__letter`)
      ?.textContent;
  }, at);

const inputValue = () => page.evaluate(() => document.querySelector('.grid__input')?.value);

// ── 1. 입력창 위치와 포커스 ──────────────────────────────────────
console.log('\n=== 1. 입력창이 칸을 정확히 덮는가 / 탭하면 포커스가 가는가 ===');
await newGame();
{
  const cells = await emptyCells();
  await cellAt(cells[2]).click({ force: true });
  await page.waitForTimeout(200);

  const m = await page.evaluate(() => {
    const input = document.querySelector('.grid__input');
    const cursor = document.querySelector('#puzzle-grid button[aria-current="true"]');
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      input: box(input),
      cursor: box(cursor),
      focused: document.activeElement === input,
      activeElement: document.activeElement
        ? `${document.activeElement.tagName.toLowerCase()}.${document.activeElement.className}`
        : 'none',
      style: getComputedStyle(input).visibility,
    };
  });

  const fits =
    Math.abs(m.input.x - m.cursor.x) <= 2 &&
    Math.abs(m.input.y - m.cursor.y) <= 2 &&
    Math.abs(m.input.w - m.cursor.w) <= 2 &&
    Math.abs(m.input.h - m.cursor.h) <= 2;
  check('입력창이 칸과 겹침', fits, `입력창 ${JSON.stringify(m.input)} / 칸 ${JSON.stringify(m.cursor)}`);
  check('포커스가 입력창에 있음', m.focused, m.focused ? '' : `실제 포커스=${m.activeElement}`);
  check('입력창이 화면에 존재', m.style === 'visible');
}

// ── 2. 조합 이벤트가 오는 경우 (데스크톱 IME) ────────────────────
console.log('\n=== 2. 조합 이벤트가 오는 입력 (데스크톱 IME) ===');
await newGame();
{
  const cells = await emptyCells();
  const at = cells[0];
  await cellAt(at).click({ force: true });
  await page.waitForTimeout(150);

  await page.evaluate(() => {
    const input = document.querySelector('.grid__input');
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }));
    input.value = 'ㄱ';
    input.dispatchEvent(new InputEvent('input', { data: 'ㄱ', bubbles: true }));
    input.value = '가';
    input.dispatchEvent(new InputEvent('input', { data: '가', bubbles: true }));
  });
  await page.waitForTimeout(150);
  check('조합 중 글자가 입력창에 유지됨', (await inputValue()) === '가');

  await page.evaluate(() => {
    document
      .querySelector('.grid__input')
      .dispatchEvent(new CompositionEvent('compositionend', { data: '가', bubbles: true }));
  });
  await page.waitForTimeout(250);
  check('확정 후 격자에 들어감', (await letterAt(at)) === '가', `칸 ${at}`);
  check('입력창이 비워짐', (await inputValue()) === '');
}

// ── 3. 조합 이벤트가 오지 않는 경우 (iOS 방식) ───────────────────
console.log('\n=== 3. 조합 이벤트 없는 입력 (iOS 한글 키보드 방식) ===');
await newGame();
{
  const cells = await emptyCells();
  const at = cells[0];
  await cellAt(at).click({ force: true });
  await page.waitForTimeout(150);

  // compositionstart 없이 자모가 음절로 합쳐지는 과정만 흘려보낸다.
  await page.evaluate(() => {
    const input = document.querySelector('.grid__input');
    input.focus();
    const step = (value) => {
      input.value = value;
      input.dispatchEvent(new InputEvent('input', { data: value, bubbles: true }));
    };
    step('ㅅ');
    step('사');
    step('산');
    step('사고'); // 다음 음절이 시작되면 앞 음절이 확정되어야 한다
  });
  await page.waitForTimeout(250);

  check('첫 음절이 격자에 확정됨', (await letterAt(at)) === '사', `칸 ${at}`);
  check('다음 음절은 입력창에 남음', (await inputValue()) === '고');
}

// ── 4. 마지막 음절 자동 확정 ─────────────────────────────────────
console.log('\n=== 4. 입력이 멎으면 마지막 음절도 확정 ===');
await newGame();
{
  const cells = await emptyCells();
  const at = cells[0];
  await cellAt(at).click({ force: true });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const input = document.querySelector('.grid__input');
    input.focus();
    input.value = '물';
    input.dispatchEvent(new InputEvent('input', { data: '물', bubbles: true }));
  });

  await page.waitForTimeout(400);
  check('바로는 확정되지 않음 (받침 대기)', (await letterAt(at)) === '');

  await page.waitForTimeout(1400); // idleCommitMs 경과
  check('멈춘 뒤 스스로 확정됨', (await letterAt(at)) === '물', `칸 ${at}`);
}

// ── 5. 한 음절만 치고 다른 칸으로 이동 ───────────────────────────
console.log('\n=== 5. 한 음절만 치고 다른 칸으로 이동해도 잃지 않음 ===');
await newGame();
{
  const cells = await emptyCells();
  const from = cells[0];
  const to = cells[cells.length - 1];
  await cellAt(from).click({ force: true });
  await page.waitForTimeout(150);

  await page.evaluate(() => {
    const input = document.querySelector('.grid__input');
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }));
    input.value = '별';
    input.dispatchEvent(new InputEvent('input', { data: '별', bubbles: true }));
  });
  await page.waitForTimeout(120);
  await cellAt(to).click({ force: true });
  await page.waitForTimeout(250);

  check('이동 전 칸에 글자가 남아 있음', (await letterAt(from)) === '별', `칸 ${from} → ${to}`);
}

// ── 6. 실제 키보드 입력 ──────────────────────────────────────────
console.log('\n=== 6. 실제 키보드로 두 음절 연속 입력 ===');
await newGame();
{
  const cells = await emptyCells();
  const at = cells[0];
  await cellAt(at).click({ force: true });
  await page.waitForTimeout(150);
  await page.keyboard.insertText('사');
  await page.waitForTimeout(150);
  await page.keyboard.insertText('회');
  await page.waitForTimeout(1500); // 마지막 음절 자동 확정까지

  const filled = await page.evaluate(
    () =>
      [...document.querySelectorAll('#puzzle-grid button.cell')].filter(
        (el) => el.querySelector('.cell__letter')?.textContent,
      ).length,
  );
  check('두 칸이 채워짐', filled >= 2, `채워진 칸 ${filled}개`);
}

const errors = logs.filter((l) => l.startsWith('[pageerror]'));
if (errors.length > 0) {
  console.log('\n=== 페이지 오류 ===');
  for (const line of errors.slice(0, 10)) console.log(line);
  failures += errors.length;
}

await page.screenshot({ path: 'dist/probe.png' });
await browser.close();

console.log(failures === 0 ? '\n전부 통과' : `\n실패 ${failures}건`);
process.exit(failures === 0 ? 0 : 1);
