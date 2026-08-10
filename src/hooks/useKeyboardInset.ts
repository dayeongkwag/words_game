import { useEffect } from 'react';

/**
 * 모바일 가상 키보드가 차지하는 높이를 CSS 변수 `--keyboard-inset` 로 노출한다.
 * (요구사항 42·43 — 힌트 팝업이 화면을 가리지 않아야 하고,
 *  입력 중 현재 칸이 가려지지 않아야 한다)
 *
 * 왜 필요한가
 *  - iOS Safari 는 키보드가 올라와도 레이아웃 뷰포트 크기를 바꾸지 않는다.
 *    그래서 `position: fixed; bottom: 0` 요소가 키보드 뒤로 숨어 버린다.
 *  - visualViewport 는 키보드를 뺀 "실제로 보이는 영역"을 알려 주므로,
 *    그 차이만큼 아래 요소를 띄우면 항상 키보드 위에 놓인다.
 *
 * 안드로이드는 index.html 의 `interactive-widget=resizes-content` 로
 * 레이아웃 자체가 줄어들지만, 두 방식이 겹쳐도 값이 0에 수렴하므로 안전하다.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;

    const update = () => {
      // 화면 아래쪽에서 키보드에 가려진 높이.
      const hidden = window.innerHeight - viewport.height - viewport.offsetTop;
      // 소수점 오차와 주소창 애니메이션으로 인한 미세한 값은 무시한다.
      const inset = hidden > 24 ? Math.round(hidden) : 0;
      root.style.setProperty('--keyboard-inset', `${inset}px`);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
