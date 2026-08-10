/**
 * 빌드 결과(dist/)를 단일 HTML 파일로 묶는다.
 *
 * 외부 요청이 전혀 없는 self-contained 페이지를 만들어,
 * 정적 호스팅이나 파일 공유만으로도 게임을 플레이할 수 있게 한다.
 *
 *   npm run build
 *   node scripts/bundle-single-file.mjs [출력경로]
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const distDir = resolve('dist');
const assetsDir = join(distDir, 'assets');
const outPath = resolve(process.argv[2] ?? 'dist/nalmal-single.html');

const assets = readdirSync(assetsDir);
const jsFile = assets.find((name) => name.endsWith('.js'));
const cssFile = assets.find((name) => name.endsWith('.css'));
if (!jsFile) throw new Error('dist/assets 에서 JS 번들을 찾지 못했습니다. 먼저 npm run build 를 실행하세요.');

const js = readFileSync(join(assetsDir, jsFile), 'utf8');
const css = cssFile ? readFileSync(join(assetsDir, cssFile), 'utf8') : '';

// index.html 에 있던 테마 선적용 스크립트를 그대로 가져온다.
const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8');
const themeScript = indexHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';

// </script> 문자열이 스크립트 내부에 있으면 태그가 조기 종료되므로 이스케이프한다.
const escapeForScript = (code) => code.replace(/<\/script>/gi, '<\\/script>');

const html = `<title>낱말퍼즐</title>
<meta name="description" content="매번 새로운 퍼즐이 생성되는 한국어 가로세로 낱말퍼즐" />
<style>
${css}
</style>
<div id="root"></div>
<script>${escapeForScript(themeScript)}</script>
<script type="module">
${escapeForScript(js)}
</script>
`;

writeFileSync(outPath, html, 'utf8');
console.log(`단일 파일 생성 완료: ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);
