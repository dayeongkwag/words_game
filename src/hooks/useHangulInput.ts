import { useCallback, useRef } from 'react';
import { isHangulSyllable } from '@/utils/hangul';

/**
 * 한글 IME 입력 처리. (요구사항 43)
 *
 * 낱말퍼즐은 "완성된 음절 하나 = 칸 하나" 이므로, 조합 중인 자모가 아니라
 * 완성된 음절만 격자에 넣어야 한다.
 *
 * 처리 방식
 *  - 숨은 input 에 IME 가 조합한 문자열이 쌓인다. (예: '가' → '간' → '가나')
 *  - 조합 중에는 마지막 글자를 제외한 앞부분이 이미 확정된 음절이므로 그때그때 커밋한다.
 *  - 아직 확정되지 않은 마지막 글자는 `onComposingChange` 로 알려 주어,
 *    **칸 안에 직접 미리 보여 준다.** (input 자체는 눈에 보이지 않는다)
 *  - compositionend 에서 남은 글자를 커밋하고 input 을 비운다.
 *
 * 이렇게 하면 사용자는 자모를 조합하는 과정을 퍼즐 칸 안에서 그대로 보게 된다.
 */
export function useHangulInput(
  onChar: (char: string) => void,
  onComposingChange?: (text: string) => void,
) {
  const composingRef = useRef(false);
  const committedRef = useRef(0);
  // 같은 값을 반복해서 알리지 않도록 마지막 값을 기억한다.
  const lastReportedRef = useRef('');

  const report = useCallback(
    (text: string) => {
      if (lastReportedRef.current === text) return;
      lastReportedRef.current = text;
      onComposingChange?.(text);
    },
    [onComposingChange],
  );

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

  /** input 버퍼와 조합 상태를 완전히 초기화한다. */
  const reset = useCallback(
    (element: HTMLInputElement | null) => {
      if (element) element.value = '';
      committedRef.current = 0;
      composingRef.current = false;
      report('');
    },
    [report],
  );

  /**
   * 조합 중이던 글자를 확정하고 버퍼를 비운다.
   *
   * 한 글자만 치고 다른 칸을 누르거나 포커스가 빠지면, IME 는 아직 조합 중이라
   * compositionend 가 오지 않는다. 그대로 두면 방금 친 글자가 사라지므로
   * 그런 순간마다 이 함수로 확정시켜 준다.
   */
  const flush = useCallback(
    (element: HTMLInputElement | null) => {
      if (!element) return;
      commitFrom(element.value, Array.from(element.value).length);
      reset(element);
    },
    [commitFrom, reset],
  );

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(
    (event: React.CompositionEvent<HTMLInputElement>) => {
      composingRef.current = false;
      const element = event.currentTarget;
      commitFrom(element.value, Array.from(element.value).length);
      reset(element);
    },
    [commitFrom, reset],
  );

  const handleInput = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const element = event.currentTarget;
      const chars = Array.from(element.value);
      // 조합 중이면 마지막 글자는 아직 바뀔 수 있으므로 커밋하지 않는다.
      const upTo = composingRef.current ? chars.length - 1 : chars.length;
      commitFrom(element.value, Math.max(0, upTo));

      if (composingRef.current) {
        // 아직 확정되지 않은 글자를 칸에 미리 보여 준다.
        report(chars.slice(committedRef.current).join(''));
      } else {
        reset(element);
      }
    },
    [commitFrom, report, reset],
  );

  return {
    /** 조합 중인지. Backspace 등을 IME 에 넘길지 판단할 때 쓴다. */
    isComposing: () => composingRef.current,
    flush,
    inputProps: {
      onInput: handleInput,
      onCompositionStart: handleCompositionStart,
      onCompositionUpdate: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
    },
    reset,
  };
}
