/**
 * 모바일 입력 재현 진단. (개발용)
 *
 *   node scripts/probe-mobile.mjs [url]
 *
 * Chromium 으로만 테스트하면 iOS 에서만 나는 문제를 놓친다.
 * Playwright 의 WebKit 은 사파리와 같은 엔진이므로, iPhone 프로필과 함께 쓰면
 * iOS 사파리에 가장 가까운 환경에서 확인할 수 있다.
 *
 * 확인 항목
 *  1) 입력창이 DOM 에 존재하고 칸과 겹치는가
 *  2) 칸을 탭했을 때 포커스가 입력창으로 가는가 (터치 이벤트로)
 *  3) readonly / disabled 로 바뀌지 않는가
 *  4) 실제 타이핑이 격자에 들어가는가
 *  5) 이벤트 순서 (beforeinput / input / composition / keydown)
 */
import { devices, webkit, chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5174/';

const targets = [
  { name: 'WebKit · iPhone 13 (iOS 사파리 엔진)', type: webkit, device: devices['iPhone 13'] },
  { name: 'Chromium · Pixel 5 (안드로이드 크롬)', type: chromium, device: devices['Pixel 5'] },
];

let failures = 0;

for (const target of targets) {
  console.log(`\n━━━━━━━━ ${target.name} ━━━━━━━━`);
  const browser = await target.type.launch();
  const context = await browser.newContext({ ...target.device });
  const page = await context.newPage();

  const events = [];
  await page.exposeFunction('__trace', (line) => events.push(line));

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '새 퍼즐 풀기' }).click();
  await page.waitForSelector('#puzzle-grid', { timeout: 20000 });

  // 입력창에 원시 이벤트 리스너를 직접 달아 순서를 기록한다.
  await page.evaluate(() => {
    const input = document.querySelector('.grid__input');
    const names = [
      'focus', 'blur', 'keydown', 'keyup', 'beforeinput', 'input',
      'change', 'compositionstart', 'compositionupdate', 'compositionend',
    ];
    for (const name of names) {
      input.addEventListener(name, (e) => {
        const data = 'data' in e ? e.data : undefined;
        window.__trace(
          `${name}${data !== undefined ? ` data=${JSON.stringify(data)}` : ''} value=${JSON.stringify(input.value)}`,
        );
      });
    }
  });

  const empty = await page.evaluate(() =>
    [...document.querySelectorAll('#puzzle-grid button.cell')]
      // 현재 커서 칸은 입력창이 덮고 있어 탭하면 방향 전환이 된다. 대상에서 뺀다.
      .filter((el) => !el.querySelector('.cell__letter')?.textContent && el.ariaCurrent !== 'true')
      .map((el) => `${el.dataset.row},${el.dataset.col}`),
  );
  const at = empty[0];
  const [row, col] = at.split(',');

  // ── 터치로 칸 선택 ────────────────────────────────────────────
  await page.locator(`#puzzle-grid [data-row="${row}"][data-col="${col}"]`).tap({ force: true });
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => {
    const input = document.querySelector('.grid__input');
    const cursor = document.querySelector('#puzzle-grid button[aria-current="true"]');
    if (!input) return { error: '입력창이 DOM 에 없음' };
    const ir = input.getBoundingClientRect();
    const cr = cursor?.getBoundingClientRect();
    const cs = getComputedStyle(input);
    return {
      exists: true,
      focused: document.activeElement === input,
      activeElement: document.activeElement?.className || document.activeElement?.tagName,
      readOnly: input.readOnly,
      disabled: input.disabled,
      overlap:
        cr && Math.abs(ir.x - cr.x) <= 2 && Math.abs(ir.y - cr.y) <= 2 && Math.abs(ir.width - cr.width) <= 2,
      rect: { x: Math.round(ir.x), y: Math.round(ir.y), w: Math.round(ir.width), h: Math.round(ir.height) },
      visibility: cs.visibility,
      display: cs.display,
      opacity: cs.opacity,
      pointerEvents: cs.pointerEvents,
      fontSize: cs.fontSize,
      color: cs.color,
    };
  });

  const check = (label, ok, detail = '') => {
    if (!ok) failures++;
    console.log(`  ${ok ? 'OK  ' : '문제'} ${label}${detail ? ` — ${detail}` : ''}`);
  };

  if (state.error) {
    check(state.error, false);
  } else {
    check('입력창이 DOM 에 존재', state.exists);
    check('readonly 아님', !state.readOnly);
    check('disabled 아님', !state.disabled);
    check('화면에 렌더링됨', state.visibility === 'visible' && state.display !== 'none');
    check('칸과 정확히 겹침', state.overlap, JSON.stringify(state.rect));
    check('탭 후 포커스가 입력창에 있음', state.focused, state.focused ? '' : `실제=${state.activeElement}`);
    console.log(
      `       스타일: opacity=${state.opacity} pointerEvents=${state.pointerEvents} fontSize=${state.fontSize} color=${state.color}`,
    );
  }

  // ── 실제 타이핑 ──────────────────────────────────────────────
  events.length = 0;
  await page.keyboard.type('사', { delay: 60 });
  await page.waitForTimeout(1600); // 마지막 음절 자동 확정 대기

  const typed = await page.evaluate((target) => {
    const [r, c] = target.split(',');
    return {
      cellText: document.querySelector(
        `#puzzle-grid [data-row="${r}"][data-col="${c}"] .cell__letter`,
      )?.textContent,
      inputValue: document.querySelector('.grid__input')?.value,
    };
  }, at);

  check(`타이핑이 칸 ${at} 에 반영됨`, typed.cellText === '사', `칸="${typed.cellText}" 입력창="${typed.inputValue}"`);

  console.log('  ── 이벤트 순서 ──');
  if (events.length === 0) console.log('       (이벤트 없음)');
  for (const line of events.slice(0, 14)) console.log(`       ${line}`);

  // ── 실제 한글 IME 조합 재현 ────────────────────────────────────
  /*
   * Playwright 의 타이핑은 완성된 음절을 한 번에 넣으므로 IME 를 재현하지 못한다.
   * 실제 폰에서 "사회" 를 치면 자모가 하나씩 들어오며 조합 이벤트가 함께 온다.
   * 그 과정을 그대로 흘려보내 본다. (조합 중 입력창을 건드리면 IME 가 깨진다)
   */
  // 앞 시나리오가 같은 낱말을 채워 두면 결과가 흔들린다. 새 게임에서 시작한다.
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '새 퍼즐 풀기' }).click();
  await page.waitForSelector('#puzzle-grid', { timeout: 20000 });

  /*
   * 두 글자 이상인 낱말을 문제 목록에서 고른다.
   * 칸을 직접 탭하면 낱말의 마지막 칸이 걸릴 수 있는데, 그러면 두 번째 음절이
   * 들어갈 칸이 없어 덮어쓰기가 일어난다(정상 동작). 검사 대상으로는 부적절하다.
   */
  const clueIndex = await page.evaluate(() =>
    [...document.querySelectorAll('.clue-item')].findIndex((el) => {
      const meta = el.querySelector('.clue-item__meta')?.textContent ?? '';
      return Number.parseInt(meta, 10) >= 2;
    }),
  );
  await page.locator('.clue-item').nth(clueIndex).tap();
  await page.waitForTimeout(250);

  /*
   * 검사 대상은 "커서가 놓인 칸부터"의 순서다.
   * 칸을 탭하면 그 칸이 커서가 되는데, 그 칸이 낱말의 첫 칸이라는 보장은 없다.
   * 낱말 중간을 탭했다면 입력도 거기서부터 채워진다.
   */
  const wordCells = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#puzzle-grid .cell--in-word')].map(
      (el) => `${el.dataset.row},${el.dataset.col}`,
    );
    const cursor = document.querySelector('#puzzle-grid button[aria-current="true"]');
    const at = `${cursor?.dataset.row},${cursor?.dataset.col}`;
    const start = Math.max(0, cells.indexOf(at));
    return cells.slice(start);
  });

  const trace = await page.evaluate(async (cells) => {
    const input = document.querySelector('.grid__input');
    input.focus();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const compose = (type, data) =>
      input.dispatchEvent(new CompositionEvent(type, { data, bubbles: true }));
    const update = (value, data) => {
      input.value = value;
      compose('compositionupdate', data);
      input.dispatchEvent(new InputEvent('input', { data, bubbles: true, isComposing: true }));
    };
    const snapshot = (label) => {
      const read = (at) => {
        const [r, c] = at.split(',');
        return (
          document.querySelector(`#puzzle-grid [data-row="${r}"][data-col="${c}"] .cell__letter`)
            ?.textContent ?? '·'
        );
      };
      const cursor = document.querySelector('#puzzle-grid button[aria-current="true"]');
      return `${label}: 칸=[${cells.slice(0, 3).map(read).join(',')}] 커서=${cursor?.dataset.row},${cursor?.dataset.col} input="${input.value}"`;
    };

    const log = [snapshot('시작')];
    compose('compositionstart', '');
    update('ㅅ', 'ㅅ');
    await sleep(120);
    log.push(snapshot('ㅅ'));
    update('사', '사');
    await sleep(120);
    log.push(snapshot('사'));
    // 사용자가 잠시 멈춘다. 이때 자동 확정 타이머가 IME 를 깨면 안 된다.
    await sleep(1500);
    log.push(snapshot('1.5초 멈춤'));
    update('사ㅎ', '사ㅎ');
    await sleep(150);
    log.push(snapshot('사ㅎ'));
    update('사회', '사회');
    await sleep(150);
    log.push(snapshot('사회'));
    compose('compositionend', '사회');
    await sleep(250);
    log.push(snapshot('조합끝'));
    return log;
  }, wordCells);
  await page.waitForTimeout(400);

  console.log('  ── IME 조합 추적 ──');
  for (const line of trace) console.log(`       ${line}`);

  const imeResult = await page.evaluate((cells) => {
    const read = (at) => {
      const [r, c] = at.split(',');
      return (
        document.querySelector(`#puzzle-grid [data-row="${r}"][data-col="${c}"] .cell__letter`)
          ?.textContent ?? ''
      );
    };
    return {
      letters: cells.slice(0, 2).map(read),
      inputValue: document.querySelector('.grid__input')?.value,
    };
  }, wordCells);

  // 낱말이 한 글자뿐이면 두 번째 음절은 들어갈 칸이 없다.
  const expected = wordCells.length >= 2 ? ['사', '회'] : ['사'];
  const got = imeResult.letters.slice(0, expected.length);
  check(
    'IME 조합으로 "사회" 입력',
    JSON.stringify(got) === JSON.stringify(expected),
    `낱말 칸=${JSON.stringify(wordCells.slice(0, 2))} 결과=${JSON.stringify(got)} 입력창="${imeResult.inputValue}"`,
  );

  if (errors.length > 0) {
    console.log('  ── 페이지 오류 ──');
    for (const e of errors.slice(0, 5)) console.log(`       ${e}`);
    failures += errors.length;
  }

  await page.screenshot({ path: `dist/probe-${target.type.name()}.png` });
  await browser.close();
}

console.log(failures === 0 ? '\n전부 통과' : `\n실패 ${failures}건`);
process.exit(failures === 0 ? 0 : 1);
