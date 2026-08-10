/**
 * 말풍선이 "지금 채우고 있는 낱말"을 가리지 않는지 실제 브라우저에서 검증한다. (개발용)
 *
 *   node scripts/probe-popover.mjs [url]
 *
 * 세로 낱말은 아래로 길게 뻗기 때문에 말풍선을 위아래에 붙이면 낱말을 그대로 덮는다.
 * 가로/세로 낱말을 모두 눌러 보며 겹침 여부를 잰다.
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5174/';
const browser = await chromium.launch({ channel: 'msedge' });

let failures = 0;

for (const viewport of [
  { name: '모바일', width: 390, height: 844 },
  { name: '데스크톱', width: 1280, height: 900 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '새 퍼즐 풀기' }).click();
  await page.waitForSelector('#puzzle-grid', { timeout: 15000 });

  console.log(`\n━━━ ${viewport.name} (${viewport.width}x${viewport.height}) ━━━`);

  // 문제 목록의 항목을 눌러 가로/세로 낱말을 차례로 선택한다.
  const clues = await page.evaluate(() =>
    [...document.querySelectorAll('.clue-item')].map((el, i) => ({
      i,
      text: el.querySelector('.clue-item__text')?.textContent?.slice(0, 18) ?? '',
    })),
  );

  for (const { i } of clues.slice(0, 8)) {
    await page.locator('.clue-item').nth(i).click();
    await page.waitForTimeout(180);

    const result = await page.evaluate(() => {
      const pop = document.querySelector('.clue-pop');
      if (!pop) return { error: '말풍선 없음' };
      const p = pop.getBoundingClientRect();

      // 강조된 칸(= 지금 채우는 낱말)들과 겹치는지 확인
      const cells = [...document.querySelectorAll('#puzzle-grid .cell--in-word')];
      let overlapped = 0;
      for (const cell of cells) {
        const c = cell.getBoundingClientRect();
        const ix = Math.max(0, Math.min(p.right, c.right) - Math.max(p.left, c.left));
        const iy = Math.max(0, Math.min(p.bottom, c.bottom) - Math.max(p.top, c.top));
        if (ix > 2 && iy > 2) overlapped++;
      }

      const side = [...pop.classList].find((c) => c.startsWith('clue-pop--'))?.replace('clue-pop--', '');
      const badge = pop.querySelector('.clue-pop__badge')?.textContent ?? '';
      const inView =
        p.top >= -1 && p.left >= -1 && p.bottom <= window.innerHeight + 1 && p.right <= window.innerWidth + 1;

      return { side, badge, wordCells: cells.length, overlapped, inView };
    });

    if (result.error) {
      console.log(`  ${result.error}`);
      failures++;
      continue;
    }

    const ok = result.overlapped === 0 && result.inView;
    if (!ok) failures++;
    console.log(
      `  ${ok ? 'OK  ' : '문제'} ${result.badge.padEnd(8)} 배치=${String(result.side).padEnd(6)} ` +
        `낱말칸=${result.wordCells} 가려진칸=${result.overlapped} 화면안=${result.inView}`,
    );
  }

  await page.close();
}

await browser.close();
console.log(failures === 0 ? '\n전부 통과: 말풍선이 낱말을 가리지 않음' : `\n실패 ${failures}건`);
process.exit(failures === 0 ? 0 : 1);
