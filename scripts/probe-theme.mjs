/**
 * 테마 확인용 스크린샷. (개발용)
 *
 *   node scripts/probe-theme.mjs [url]
 *
 * 라이트/다크 각각의 시작 화면과 게임 화면을 찍고,
 * 본문 색 대비가 접근성 기준(4.5:1)을 넘는지 함께 잰다. (요구사항 44)
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5174/';
const browser = await chromium.launch({ channel: 'msedge' });

/** WCAG 상대 휘도 */
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const parse = (css) => css.match(/\d+/g).slice(0, 3).map(Number);

let failures = 0;

for (const theme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((t) => {
    localStorage.setItem('nalmal:theme:v1', JSON.stringify({ mode: t }));
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });

  await page.screenshot({ path: `dist/theme-${theme}-start.png` });

  await page.getByRole('button', { name: '새 퍼즐 풀기' }).click();
  await page.waitForSelector('#puzzle-grid', { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `dist/theme-${theme}-game.png` });

  const colors = await page.evaluate(() => {
    const get = (selector, prop = 'color') => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el)[prop] : null;
    };
    return {
      bg: getComputedStyle(document.body).backgroundColor,
      text: getComputedStyle(document.body).color,
      muted: get('.status-bar__label'),
      faint: get('.clue-item__meta'),
      accent: get('.clue-list__title'),
      cellBg: get('#puzzle-grid button.cell', 'backgroundColor'),
      cellText: get('#puzzle-grid button.cell'),
      surface: get('.status-bar', 'backgroundColor'),
    };
  });

  console.log(`\n━━━ ${theme} ━━━`);
  console.log(`  배경 ${colors.bg} / 카드 ${colors.surface}`);

  const bg = parse(colors.bg);
  const pairs = [
    ['본문', colors.text, 4.5],
    ['보조 텍스트', colors.muted, 4.5],
    ['옅은 텍스트', colors.faint, 4.5],
    ['포인트 컬러', colors.accent, 4.5],
  ];
  for (const [label, color, min] of pairs) {
    if (!color) continue;
    const ratio = contrast(parse(color), bg);
    const ok = ratio >= min;
    if (!ok) failures++;
    console.log(`  ${ok ? 'OK  ' : '문제'} ${label} 대비 ${ratio.toFixed(2)}:1 (기준 ${min}) ${color}`);
  }

  const cellRatio = contrast(parse(colors.cellText), parse(colors.cellBg));
  const cellOk = cellRatio >= 4.5;
  if (!cellOk) failures++;
  console.log(`  ${cellOk ? 'OK  ' : '문제'} 퍼즐 칸 글자 대비 ${cellRatio.toFixed(2)}:1`);

  await page.close();
}

await browser.close();
console.log(failures === 0 ? '\n대비 기준 전부 통과' : `\n기준 미달 ${failures}건`);
process.exit(failures === 0 ? 0 : 1);
