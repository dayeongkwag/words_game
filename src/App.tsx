import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/common/Button';
import { DebugPanel } from '@/components/common/DebugPanel';
import { GameScreen } from '@/components/game/GameScreen';
import { StartScreen } from '@/components/game/StartScreen';
import { ResultScreen } from '@/components/result/ResultScreen';
import { SharedPromptScreen } from '@/components/sharing/SharedPromptScreen';
import { getGameConfig } from '@/config';
import { parseShareParams, type ShareLinkParams } from '@/game/puzzleShare';
import { useGame } from '@/hooks/useGame';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useTheme } from '@/hooks/useTheme';
import { recordStore } from '@/storage';
import type { PlayRecord } from '@/types';

type Screen = 'home' | 'shared' | 'game' | 'result';

export default function App() {
  const theme = useTheme();
  const game = useGame();
  // 모바일 가상 키보드 높이를 CSS 변수로 노출한다. (하단 문제 카드가 가려지지 않게)
  useKeyboardInset();

  const [screen, setScreen] = useState<Screen>('home');
  const [sharedParams, setSharedParams] = useState<ShareLinkParams | null>(null);
  const [records, setRecords] = useState<PlayRecord[]>([]);
  // 같은 게임 결과를 두 번 저장하지 않도록 기록해 둔다.
  const savedResultRef = useRef<string | null>(null);

  const refreshRecords = useCallback(() => {
    setRecords(recordStore.list(getGameConfig().records.display));
  }, []);

  // 첫 진입: 공유 링크 여부 확인 (요구사항 38)
  useEffect(() => {
    refreshRecords();
    const params = parseShareParams(window.location.search);
    if (params && (params.seed || params.snapshot)) {
      setSharedParams(params);
      setScreen('shared');
    }
  }, [refreshRecords]);

  // 게임이 끝나면 기록을 저장하고 결과 화면으로 넘어간다. (요구사항 33)
  useEffect(() => {
    const status = game.state?.status;
    if (status !== 'COMPLETED' && status !== 'GAME_OVER') return;
    if (!game.result) return;

    const key = `${game.result.puzzleId}:${game.result.playedAt}`;
    if (savedResultRef.current !== key) {
      savedResultRef.current = key;
      recordStore.add(game.result);
      refreshRecords();
    }
    setScreen('result');
  }, [game.state?.status, game.result, refreshRecords]);

  const clearShareParams = useCallback(() => {
    // 새 퍼즐을 시작하면 주소창의 공유 파라미터를 지운다.
    // 샌드박스 iframe 등에서는 history 조작이 막힐 수 있으므로 실패해도 진행한다.
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {
      // 주소만 그대로 남을 뿐 게임 진행에는 영향이 없다.
    }
    setSharedParams(null);
  }, []);

  const startNew = useCallback(async () => {
    clearShareParams();
    savedResultRef.current = null;
    setScreen('game');
    await game.startNew();
  }, [game, clearShareParams]);

  const replay = useCallback(async () => {
    savedResultRef.current = null;
    setScreen('game');
    await game.replay();
  }, [game]);

  const playShared = useCallback(async () => {
    if (!sharedParams) return startNew();
    savedResultRef.current = null;
    setScreen('game');
    await game.startFromShare(sharedParams);
  }, [game, sharedParams, startNew]);

  const goHome = useCallback(() => {
    clearShareParams();
    refreshRecords();
    setScreen('home');
  }, [clearShareParams, refreshRecords]);

  // ── 화면 분기 ─────────────────────────────────────────────────
  if (screen === 'shared') {
    return (
      <main className="app">
        <SharedPromptScreen
          loading={game.phase === 'loading'}
          theme={theme.resolved}
          onToggleTheme={theme.toggle}
          onPlayShared={playShared}
          onPlayNew={startNew}
        />
      </main>
    );
  }

  if (screen === 'home') {
    return (
      <main className="app">
        <StartScreen
          records={records}
          loading={game.phase === 'loading'}
          theme={theme.resolved}
          onToggleTheme={theme.toggle}
          onStart={startNew}
        />
      </main>
    );
  }

  if (game.phase === 'loading' || (game.phase === 'idle' && screen === 'game')) {
    return (
      <main className="app app--center">
        <div className="loading" role="status">
          <span className="loading__spinner" aria-hidden="true" />
          <p>새로운 퍼즐을 만드는 중…</p>
        </div>
      </main>
    );
  }

  if (game.phase === 'error') {
    return (
      <main className="app app--center">
        <div className="error-box" role="alert">
          <h2>퍼즐을 만들지 못했습니다</h2>
          <p>{game.error}</p>
          <Button variant="primary" onClick={startNew}>
            다시 시도
          </Button>
          <Button variant="ghost" onClick={goHome}>
            처음 화면으로
          </Button>
        </div>
      </main>
    );
  }

  if (screen === 'result' && game.result && game.puzzle && game.view && game.state) {
    return (
      <main className="app">
        <ResultScreen
          result={game.result}
          puzzle={game.puzzle}
          view={game.view}
          state={game.state}
          theme={theme.resolved}
          onReplay={replay}
          onNewPuzzle={startNew}
          onHome={goHome}
        />
      </main>
    );
  }

  if (game.view && game.state && game.hints) {
    return (
      <main className="app">
        <GameScreen
          view={game.view}
          state={game.state}
          hints={game.hints}
          theme={theme.resolved}
          notice={game.notice}
          onToggleTheme={theme.toggle}
          onExit={goHome}
          dispatch={game.dispatch}
        />
        <DebugPanel />
      </main>
    );
  }

  return (
    <main className="app app--center">
      <div className="loading" role="status">
        <span className="loading__spinner" aria-hidden="true" />
        <p>불러오는 중…</p>
      </div>
    </main>
  );
}
