import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ClueView } from '@/types';

interface CluePopoverProps {
  clue: ClueView | null;
  solved: boolean;
  /** 말풍선이 가리킬 칸. 보통 현재 커서 칸이다. */
  anchorRow: number;
  anchorCol: number;
  /** 초성 힌트를 사용했다면 그 초성 문자열. */
  initials?: string;
}

/** 말풍선이 낱말의 어느 쪽에 놓였는지. 꼬리 방향을 결정한다. */
type Side = 'top' | 'bottom' | 'left' | 'right';

interface Placement {
  top: number;
  left: number;
  side: Side;
  /** 꼬리 위치(말풍선 기준 px). 위/아래면 가로 좌표, 좌/우면 세로 좌표. */
  arrowOffset: number;
}

interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const GAP = 10;
const EDGE = 8;

/** 격자 칸의 화면상 위치. 없으면 null. */
function cellRect(row: number, col: number): Rect | null {
  const element = document.querySelector<HTMLElement>(
    `#puzzle-grid [data-row="${row}"][data-col="${col}"]`,
  );
  if (!element) return null;
  const r = element.getBoundingClientRect();
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

/**
 * 선택한 칸에 붙는 말풍선 문제 카드. (요구사항 22)
 *
 * - 칸의 위쪽에 붙이되, 공간이 부족하면 아래쪽으로 뒤집는다.
 * - 화면 밖으로 나가지 않도록 가로 위치를 잘라 맞추고, 꼬리만 칸을 가리키게 둔다.
 * - 모바일 가상 키보드가 올라오면 그만큼 보이는 영역이 줄어드는데,
 *   visualViewport 기준으로 계산하므로 키보드에 가려지지 않는다.
 */
export function CluePopover({
  clue,
  solved,
  anchorRow,
  anchorCol,
  initials,
}: CluePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const reposition = useCallback(() => {
    const element = ref.current;
    if (!element || !clue) return;

    const anchor = cellRect(anchorRow, anchorCol);
    if (!anchor) return;

    /*
     * 낱말 전체가 차지하는 영역을 구한다.
     * 말풍선이 절대 덮으면 안 되는 것은 "지금 채우고 있는 낱말"이므로,
     * 커서 칸 하나가 아니라 낱말 전체를 기준으로 자리를 잡는다.
     */
    const lastRow = clue.startRow + (clue.direction === 'down' ? clue.length - 1 : 0);
    const lastCol = clue.startCol + (clue.direction === 'across' ? clue.length - 1 : 0);
    const head = cellRect(clue.startRow, clue.startCol) ?? anchor;
    const tail = cellRect(lastRow, lastCol) ?? anchor;
    const word: Rect = {
      top: Math.min(head.top, tail.top),
      left: Math.min(head.left, tail.left),
      right: Math.max(head.right, tail.right),
      bottom: Math.max(head.bottom, tail.bottom),
      get width() {
        return this.right - this.left;
      },
      get height() {
        return this.bottom - this.top;
      },
    };

    const box = element.getBoundingClientRect();

    /*
     * 말풍선은 position: fixed 라 좌표 기준이 레이아웃 뷰포트다.
     * 가상 키보드가 차지하는 높이를 빼서 "절대 넘어가면 안 되는 하한"을 구한다.
     * iOS 는 키보드가 올라와도 window.innerHeight 가 그대로이므로 이 보정이 꼭 필요하다.
     */
    const viewport = window.visualViewport;
    const keyboard = viewport
      ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      : 0;

    const safeTop = EDGE;
    const safeBottom = window.innerHeight - keyboard - EDGE;
    const safeLeft = EDGE;
    const safeRight = window.innerWidth - EDGE;

    const clampX = (value: number) =>
      Math.max(safeLeft, Math.min(value, Math.max(safeLeft, safeRight - box.width)));
    const clampY = (value: number) =>
      Math.max(safeTop, Math.min(value, Math.max(safeTop, safeBottom - box.height)));

    /*
     * 자리 우선순위. 낱말을 덮지 않는 자리를 먼저 고른다.
     *  - 세로 낱말: 아래로 길게 뻗으므로 위아래에 붙이면 낱말을 그대로 덮는다. → 좌우 우선
     *  - 가로 낱말: 옆으로 뻗으므로 위아래 우선
     */
    const roomRight = safeRight - word.right - GAP;
    const roomLeft = word.left - GAP - safeLeft;
    const roomAbove = word.top - GAP - safeTop;
    const roomBelow = safeBottom - word.bottom - GAP;

    const order: Side[] =
      clue.direction === 'down'
        ? ['right', 'left', 'top', 'bottom']
        : ['top', 'bottom', 'right', 'left'];

    const room: Record<Side, number> = {
      right: roomRight,
      left: roomLeft,
      top: roomAbove,
      bottom: roomBelow,
    };
    const needed: Record<Side, number> = {
      right: box.width,
      left: box.width,
      top: box.height,
      bottom: box.height,
    };

    // 들어갈 자리가 있으면 그곳, 없으면 그중 가장 넉넉한 쪽.
    const side =
      order.find((candidate) => room[candidate] >= needed[candidate]) ??
      order.reduce((best, candidate) =>
        room[candidate] - needed[candidate] > room[best] - needed[best] ? candidate : best,
      );

    let top: number;
    let left: number;

    if (side === 'right' || side === 'left') {
      left =
        side === 'right' ? word.right + GAP : word.left - box.width - GAP;
      left = clampX(left);
      // 세로로는 커서 칸 높이에 맞춘다.
      top = clampY(anchor.top + anchor.height / 2 - box.height / 2);
    } else {
      top = side === 'top' ? word.top - box.height - GAP : word.bottom + GAP;
      top = clampY(top);
      left = clampX(word.left + word.width / 2 - box.width / 2);
    }

    // 꼬리는 잘린 만큼 보정해 항상 커서 칸을 가리키게 한다.
    const arrowOffset =
      side === 'right' || side === 'left'
        ? Math.max(14, Math.min(box.height - 14, anchor.top + anchor.height / 2 - top))
        : Math.max(14, Math.min(box.width - 14, anchor.left + anchor.width / 2 - left));

    setPlacement({ top, left, side, arrowOffset });
  }, [anchorRow, anchorCol, clue]);

  useLayoutEffect(() => {
    if (!clue) return;
    reposition();
  }, [clue, reposition, initials, solved]);

  useEffect(() => {
    if (!clue) return;
    const handler = () => reposition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    window.visualViewport?.addEventListener('resize', handler);
    window.visualViewport?.addEventListener('scroll', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
      window.visualViewport?.removeEventListener('resize', handler);
      window.visualViewport?.removeEventListener('scroll', handler);
    };
  }, [clue, reposition]);

  if (!clue) return null;

  return (
    <div
      ref={ref}
      className={`clue-pop clue-pop--${placement?.side ?? 'top'}`}
      style={{
        top: placement?.top ?? 0,
        left: placement?.left ?? 0,
        // 위치를 계산하기 전에는 보이지 않게 두어 깜빡임을 막는다.
        visibility: placement ? 'visible' : 'hidden',
        ['--arrow-offset' as string]: `${placement?.arrowOffset ?? 0}px`,
      }}
      role="dialog"
      aria-live="polite"
      aria-label="선택한 문제"
    >
      <div className="clue-pop__head">
        <span className="clue-pop__badge">
          {clue.direction === 'across' ? '가로' : '세로'} {clue.number}
        </span>
        <span className="clue-pop__length">{clue.length}글자</span>
        {solved && <span className="clue-pop__solved">정답</span>}
      </div>

      <p className="clue-pop__text">{clue.clue}</p>

      {initials && (
        <p className="clue-pop__initials">
          <span className="clue-pop__initials-label">초성</span>
          <span className="clue-pop__initials-value">{initials}</span>
        </p>
      )}

      {/*
        누를 수 있는 요소를 여기에 두지 않는다.
        말풍선은 격자 위에 떠 있어서 버튼이 있으면 그 아래 칸의 탭을 가로챈다.
        칸이 선택되지 않고 입력창은 포커스를 잃어 "키보드는 떠 있는데 글자가 안 쳐지는"
        상태가 된다. 힌트 버튼은 상태 바에 둔다. (GameScreen)
      */}
      <span className="clue-pop__arrow" aria-hidden="true" />
    </div>
  );
}
