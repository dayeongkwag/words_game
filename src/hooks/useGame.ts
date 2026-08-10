import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getGameConfig } from '@/config';
import { getWordRepository } from '@/data/repositories';
import { createInitialState, gameReducer, toGameResult, type GameAction } from '@/game/gameState';
import { getHintAvailability, type HintAvailability } from '@/game/hintSystem';
import { generatePuzzle } from '@/game/puzzleGenerator';
import { restoreSharedPuzzle, type ShareLinkParams } from '@/game/puzzleShare';
import { toPuzzleView } from '@/game/puzzleView';
import type { GameResult, GameState, Puzzle, PuzzleView } from '@/types';
import { createSeedString } from '@/utils/random';

/**
 * 게임 한 판의 수명 주기를 관리하는 훅.
 *
 * 퍼즐 생성·상태 전이·타이머·기록 저장 트리거를 한곳에 모아 두고,
 * 실제 규칙은 모두 `src/game/*` 의 순수 모듈에 위임한다.
 * (UI 컴포넌트에는 게임 규칙이 전혀 들어가지 않는다.)
 */

export type GamePhase = 'idle' | 'loading' | 'ready' | 'error';

export interface UseGameResult {
  phase: GamePhase;
  error: string | null;
  puzzle: Puzzle | null;
  view: PuzzleView | null;
  state: GameState | null;
  hints: HintAvailability | null;
  result: GameResult | null;
  /** 공유 링크 복원 시 완전히 동일하지 않았을 때의 안내 문구. */
  notice: string | null;
  dispatch: (action: GameAction) => void;
  /** 완전히 새로운 시드로 새 퍼즐. (요구사항 54) */
  startNew: () => Promise<void>;
  /** 같은 퍼즐 다시 풀기. */
  replay: () => Promise<void>;
  /** 공유 링크 파라미터로 퍼즐 복원. (요구사항 36·38) */
  startFromShare: (params: ShareLinkParams) => Promise<void>;
}

export function useGame(): UseGameResult {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [state, setState] = useState<GameState | null>(null);

  // 리듀서는 정답 데이터를 인자로 받으므로 최신 퍼즐을 ref 로 들고 있는다.
  const puzzleRef = useRef<Puzzle | null>(null);
  // 늦게 도착한 비동기 생성 결과가 최신 게임을 덮어쓰지 않도록 하는 토큰.
  const loadTokenRef = useRef(0);

  const view = useMemo(() => (puzzle ? toPuzzleView(puzzle) : null), [puzzle]);

  const dispatch = useCallback((action: GameAction) => {
    const current = puzzleRef.current;
    if (!current) return;
    setState((prev) => (prev ? gameReducer(prev, action, { puzzle: current }) : prev));
  }, []);

  const load = useCallback(async (loader: () => Promise<{ puzzle: Puzzle; notice?: string }>) => {
    const token = ++loadTokenRef.current;
    setPhase('loading');
    setError(null);
    setNotice(null);
    try {
      const { puzzle: next, notice: nextNotice } = await loader();
      if (token !== loadTokenRef.current) return;
      puzzleRef.current = next;
      setPuzzle(next);
      setState(createInitialState(next));
      setNotice(nextNotice ?? null);
      setPhase('ready');
    } catch (cause) {
      if (token !== loadTokenRef.current) return;
      console.error('[useGame] 퍼즐 생성 실패', cause);
      setError(
        cause instanceof Error ? cause.message : '퍼즐을 만들지 못했습니다. 다시 시도해 주세요.',
      );
      setPhase('error');
    }
  }, []);

  const startNew = useCallback(async () => {
    await load(async () => ({
      puzzle: await generatePuzzle({ seed: createSeedString(), repository: getWordRepository() }),
    }));
  }, [load]);

  const replay = useCallback(async () => {
    const seed = puzzleRef.current?.seed;
    if (!seed) return startNew();
    await load(async () => ({
      puzzle: await generatePuzzle({ seed, repository: getWordRepository() }),
    }));
  }, [load, startNew]);

  const startFromShare = useCallback(
    async (params: ShareLinkParams) => {
      await load(async () => {
        const restored = await restoreSharedPuzzle(params, { repository: getWordRepository() });
        if (!restored) throw new Error('공유 링크에서 퍼즐을 복원하지 못했습니다.');
        return { puzzle: restored.puzzle, notice: restored.warning };
      });
    },
    [load],
  );

  // ── 타이머 (요구사항 31) ────────────────────────────────────────
  useEffect(() => {
    if (state?.status !== 'PLAYING') return;
    const { tickMs } = getGameConfig().timer;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      dispatch({ type: 'TICK', deltaMs: delta });
    }, tickMs);
    return () => window.clearInterval(id);
  }, [state?.status, dispatch]);

  // 탭이 백그라운드로 가면 자동으로 일시정지한다.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.hidden) dispatch({ type: 'PAUSE' });
      else dispatch({ type: 'RESUME' });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [dispatch]);

  const hints = useMemo(
    () => (state && puzzle ? getHintAvailability(state, puzzle) : null),
    [state, puzzle],
  );

  const result = useMemo(() => {
    if (!state || !puzzle) return null;
    if (state.status !== 'COMPLETED' && state.status !== 'GAME_OVER') return null;
    return toGameResult(state, puzzle);
  }, [state, puzzle]);

  return {
    phase,
    error,
    puzzle,
    view,
    state,
    hints,
    result,
    notice,
    dispatch,
    startNew,
    replay,
    startFromShare,
  };
}
