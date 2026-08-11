import { getShareConfig } from '@/config';
import type { GameResult, PuzzleView } from '@/types';
import { formatDuration, formatScore } from './format';

/**
 * 결과 이미지 생성. (요구사항 39)
 *
 * 외부 라이브러리 없이 Canvas 2D 만 사용한다.
 * - Android/Chrome: Blob 다운로드
 * - iOS/Safari: 다운로드가 막히는 경우가 많아 Web Share(files) → 새 탭 열기 순으로 폴백
 */

const WIDTH = 1080;
const HEIGHT = 1350;

export interface ResultImageOptions {
  result: GameResult;
  view: PuzzleView;
  /** 격자에서 이미 푼 칸(색을 채워 그린다). "row,col" 형식. */
  solvedCells: ReadonlySet<string>;
  theme: 'light' | 'dark';
}

/** 결과 카드를 그린 캔버스를 만든다. */
export function renderResultCanvas(options: ResultImageOptions): HTMLCanvasElement {
  const { result, view, solvedCells, theme } = options;
  const config = getShareConfig();
  const palette = theme === 'dark' ? DARK : LIGHT;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없습니다.');

  const font = (size: number, weight = 400) =>
    `${weight} ${size}px "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;

  // 배경
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 카드
  const cardX = 60;
  const cardY = 60;
  const cardW = WIDTH - 120;
  const cardH = HEIGHT - 120;
  roundRect(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.fillStyle = palette.surface;
  ctx.fill();

  // 타이틀
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.accent;
  ctx.font = font(34, 700);
  ctx.fillText(result.status === 'COMPLETED' ? '퍼즐 클리어!' : '게임 종료', WIDTH / 2, cardY + 110);

  ctx.fillStyle = palette.text;
  ctx.font = font(62, 800);
  ctx.fillText(config.title, WIDTH / 2, cardY + 190);

  // 점수
  ctx.fillStyle = palette.accent;
  ctx.font = font(130, 800);
  ctx.fillText(formatScore(result.score), WIDTH / 2, cardY + 340);
  ctx.fillStyle = palette.muted;
  ctx.font = font(30, 500);
  ctx.fillText('점', WIDTH / 2, cardY + 385);

  // 미니 퍼즐 그림
  drawMiniGrid(ctx, view, solvedCells, palette, {
    top: cardY + 430,
    height: 380,
    centerX: WIDTH / 2,
  });

  // 지표
  const stats: [string, string][] = [
    ['시간', formatDuration(result.elapsedMs)],
    ['오답', `${result.mistakes}회`],
    ['힌트', `${result.hintsUsed}회`],
    ['단어', `${result.solvedWords}/${result.totalWords}`],
  ];

  const statY = cardY + cardH - 210;
  const statW = cardW / stats.length;
  stats.forEach(([label, value], index) => {
    const cx = cardX + statW * index + statW / 2;
    ctx.fillStyle = palette.muted;
    ctx.font = font(28, 500);
    ctx.fillText(label, cx, statY);
    ctx.fillStyle = palette.text;
    ctx.font = font(46, 700);
    ctx.fillText(value, cx, statY + 60);
  });

  // 난이도 뱃지
  ctx.fillStyle = palette.muted;
  ctx.font = font(28, 500);
  ctx.fillText(`난이도 ${result.difficulty.label}`, WIDTH / 2, cardY + cardH - 70);

  return canvas;
}

interface GridArea {
  top: number;
  height: number;
  centerX: number;
}

function drawMiniGrid(
  ctx: CanvasRenderingContext2D,
  view: PuzzleView,
  solvedCells: ReadonlySet<string>,
  palette: Palette,
  area: GridArea,
): void {
  const cell = Math.min(area.height / view.rows, (WIDTH - 260) / view.cols, 46);
  const gridW = cell * view.cols;
  const gridH = cell * view.rows;
  const left = area.centerX - gridW / 2;
  const top = area.top + (area.height - gridH) / 2;

  for (let r = 0; r < view.rows; r++) {
    for (let c = 0; c < view.cols; c++) {
      if (view.blocked[r][c]) continue;
      const x = left + c * cell;
      const y = top + r * cell;
      const solved = solvedCells.has(`${r},${c}`);
      ctx.fillStyle = solved ? palette.accentSoft : palette.cell;
      roundRect(ctx, x + 1.5, y + 1.5, cell - 3, cell - 3, 5);
      ctx.fill();
      ctx.strokeStyle = solved ? palette.accent : palette.border;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

interface Palette {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  cell: string;
  border: string;
}

// tokens.css 의 라이트 모드 값과 맞춘다. (캔버스는 CSS 변수를 쓸 수 없어 따로 둔다)
const LIGHT: Palette = {
  bg: '#e6e8ee',
  surface: '#ffffff',
  text: '#1a1c23',
  muted: '#5c616e',
  accent: '#5b5bd6',
  accentSoft: '#e9e9fb',
  cell: '#f2f3f6',
  border: '#dcdfe6',
};

const DARK: Palette = {
  bg: '#0f0d14',
  surface: '#1e1b26',
  text: '#f0ecf5',
  muted: '#a9a1b8',
  accent: '#a78bfa',
  accentSoft: '#332a4a',
  cell: '#272231',
  border: '#3a3446',
};

export type SaveImageOutcome = 'downloaded' | 'shared' | 'opened' | 'failed';

/**
 * 결과 이미지를 저장한다.
 * iOS Safari 는 다운로드 속성이 제한적이라 공유 시트 → 새 탭 순으로 폴백한다.
 */
export async function saveResultImage(options: ResultImageOptions): Promise<SaveImageOutcome> {
  let canvas: HTMLCanvasElement;
  try {
    canvas = renderResultCanvas(options);
  } catch {
    return 'failed';
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((value) => resolve(value), 'image/png'),
  );
  if (!blob) return 'failed';

  const fileName = `낱말퍼즐-${options.result.puzzleId}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  // 1) 파일 공유를 지원하면 공유 시트를 연다. (iOS 에서 가장 안정적)
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] }) &&
    typeof navigator.share === 'function'
  ) {
    try {
      await navigator.share({ files: [file], title: getShareConfig().title });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'failed';
    }
  }

  // 2) 일반적인 다운로드
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return 'downloaded';
  } catch {
    // 3) 새 탭에서 열어 길게 눌러 저장하도록 안내
    window.open(url, '_blank');
    return 'opened';
  } finally {
    // 다운로드가 시작될 시간을 준 뒤 해제한다.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
