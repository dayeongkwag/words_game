/**
 * 개발용 미리보기 스크립트.
 * 터미널에서 생성된 퍼즐의 모양과 통계를 확인한다.
 *
 *   npx vite-node scripts/preview-puzzle.ts [seed...]
 */
import { MockWordRepository } from '../src/data/repositories/MockWordRepository';
import { generatePuzzle } from '../src/game/puzzleGenerator';
import { checkQuality, placementsToWordLike } from '../src/game/puzzleValidator';

const seeds = process.argv.slice(2);
const repository = new MockWordRepository();

const targets = seeds.length > 0 ? seeds : ['seed1', 'k7m2p9', 'abcde', 'zz99xx', 'nalmal'];

for (const seed of targets) {
  const started = Date.now();
  const puzzle = await generatePuzzle({ seed, repository });
  const elapsed = Date.now() - started;
  const { stats, shapeScore, issues } = checkQuality(placementsToWordLike(puzzle.words), {
    strict: true,
  });

  console.log(`\n━━━ seed=${seed} (${elapsed}ms) ━━━`);
  console.log(
    `${puzzle.rows}×${puzzle.cols} · 단어 ${puzzle.words.length}개 ` +
      `(가로 ${stats.acrossCount} / 세로 ${stats.downCount}) · 교차 ${stats.intersections} · ` +
      `밀도 ${stats.density.toFixed(2)} · 난이도 ${puzzle.difficulty.label}(${puzzle.difficulty.score}) · ` +
      `모양점수 ${shapeScore.toFixed(1)}`,
  );
  if (issues.length > 0) console.log(`품질 경고: ${issues.join(', ')}`);

  for (let r = 0; r < puzzle.rows; r++) {
    let line = '';
    for (let c = 0; c < puzzle.cols; c++) {
      line += puzzle.grid[r][c] ?? ' ·';
    }
    console.log(line);
  }

  console.log('\n[가로]');
  for (const w of puzzle.words.filter((w) => w.direction === 'across')) {
    console.log(`  ${w.number}. ${w.clue} (${w.length}글자) → ${w.word}`);
  }
  console.log('[세로]');
  for (const w of puzzle.words.filter((w) => w.direction === 'down')) {
    console.log(`  ${w.number}. ${w.clue} (${w.length}글자) → ${w.word}`);
  }
}
