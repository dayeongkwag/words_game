import { useCallback, useEffect, useRef } from 'react';
import { UI_CONFIG } from '@/config';
import { isHangulSyllable } from '@/utils/hangul';

/**
 * 한글 IME 입력 처리. (요구사항 43)
 *
 * 낱말퍼즐은 "완성된 음절 하나 = 칸 하나" 이므로, 조합 중인 자모가 아니라
 * 완성된 음절만 격자에 넣어야 한다.
 *
 * ── 왜 조합(composition) 이벤트에 의존하지 않는가 ──────────────────
 * 데스크톱 IME 는 compositionstart 를 먼저 보내 주지만, iOS 한글 키보드는
 * 그렇지 않은 경우가 있다. "조합 중이 아니다" 라고 판단해 입력창을 비워 버리면
 * 첫 자모(ㄱ)가 그 자리에서 사라져 영원히 음절을 만들 수 없다. (실제 겪은 버그)
 *
 * 그래서 조합 여부와 무관하게 다음 규칙만으로 처리한다.
 *   - 입력창에 쌓인 글자 중 **마지막 글자를 제외한 앞부분**은 더 이상 바뀌지 않는다.
 *     → 완성된 음절이면 격자에 확정한다.
 *   - 마지막 글자는 아직 바뀔 수 있으므로(가 → 각) 입력창에 남겨 두고,
 *     칸 위에 그대로 보여 준다.
 *   - 확정 시점은 compositionend / 다른 칸으로 이동 / 포커스 해제 / 입력이 멈춤.
 *
 * 이 규칙은 조합 이벤트가 오든 안 오든 동일하게 동작한다.
 */
export function useHangulInput(
  onChar: (char: string) => void,
  onComposingChange?: (text: string) => void,
) {
  const composingRef = useRef(false);
  /** 이미 격자에 확정해 넘긴 글자 수. */
  const committedRef = useRef(0);
  const lastReportedRef = useRef('');
  const idleTimerRef = useRef<number | null>(null);
  const elementRef = useRef<HTMLInputElement | null>(null);

  const report = useCallback(
    (text: string) => {
      if (lastReportedRef.current === text) return;
      lastReportedRef.current = text;
      onComposingChange?.(text);
    },
    [onComposingChange],
  );

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  /** 확정된 앞부분을 격자로 넘긴다. */
  const commitFrom = useCallback(
    (value: string, upTo: number) => {
      const chars = Array.from(value);
      for (let i = committedRef.current; i < upTo && i < chars.length; i++) {
        if (isHangulSyllable(chars[i])) onChar(chars[i]);
      }
      committedRef.current = Math.max(committedRef.current, Math.min(upTo, chars.length));
    },
    [onChar],
  );

  const reset = useCallback(
    (element: HTMLInputElement | null) => {
      clearIdleTimer();
      if (element) element.value = '';
      committedRef.current = 0;
      composingRef.current = false;
      report('');
    },
    [report, clearIdleTimer],
  );

  /**
   * 남아 있는 글자를 모두 확정하고 버퍼를 비운다.
   *
   * 한 음절만 치고 다른 칸을 누르거나 포커스가 빠지면 IME 는 아직 조합 중이라
   * compositionend 가 오지 않는다. 그대로 두면 방금 친 글자가 사라지므로
   * 그런 순간마다 이 함수로 확정시킨다.
   */
  const flush = useCallback(
    (element: HTMLInputElement | null) => {
      clearIdleTimer();
      if (!element) return;
      commitFrom(element.value, Array.from(element.value).length);
      reset(element);
    },
    [commitFrom, reset, clearIdleTimer],
  );

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (event: React.CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      flush(event.currentTarget);
    },
    [flush],
  );

  const handleInput = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const element = event.currentTarget;
      elementRef.current = element;
      clearIdleTimer();

      const chars = Array.from(element.value);
      // 마지막 글자는 아직 바뀔 수 있다(가 → 각). 그 앞까지만 확정한다.
      commitFrom(element.value, Math.max(0, chars.length - 1));

      const pending = chars.slice(committedRef.current).join('');
      report(pending);

      // 조합 중이 아닐 때만 입력창을 정리한다.
      // 조합 중에 value 를 건드리면 IME 의 상태가 깨진다.
      if (!composingRef.current && pending !== element.value) {
        element.value = pending;
        committedRef.current = 0;
      }

      /*
       * 마지막 음절은 다음 글자를 쳐야 확정된다. 낱말의 끝 글자를 치고 멈추면
       * 확정이 안 되어 채점이 일어나지 않으므로, 입력이 멎으면 스스로 확정한다.
       * 받침을 덧붙이는 시간(보통 0.3초 이내)보다 넉넉하게 잡는다.
       */
      if (pending) {
        idleTimerRef.current = window.setTimeout(() => {
          idleTimerRef.current = null;
          flush(elementRef.current);
        }, UI_CONFIG.input.idleCommitMs);
      }
    },
    [commitFrom, report, clearIdleTimer, flush],
  );

  useEffect(() => clearIdleTimer, [clearIdleTimer]);

  return {
    /** 조합 중인지. Backspace 등을 IME 에 넘길지 판단할 때 쓴다. */
    isComposing: () => composingRef.current,
    flush,
    reset,
    inputProps: {
      onInput: handleInput,
      onCompositionStart: handleCompositionStart,
      onCompositionUpdate: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
    },
  };
}
