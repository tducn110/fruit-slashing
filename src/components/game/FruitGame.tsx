import { useEffect, useRef, useState, useCallback } from "react";
import {
  GAME_DURATION_MS,
  createGame,
  timeLeftSeconds,
  getGameConfig,
  TICK_RATE,
  type GameState,
  type SliceResult,
} from "../../game/core";
import type { GameResult } from "../../game/types";
import { useGameSession } from "../../features/game/runtime/useGameSession";
import { useSlashTrail, type TrailPoint } from "../../features/game/input/useSlashTrail";
import { useGamePointerInput } from "../../features/game/input/useGamePointerInput";
import { useGameTicker } from "../../features/game/runtime/useGameTicker";
import { GameHud, type HudState } from "./GameHud";
import { CountdownOverlay } from "./CountdownOverlay";
import { GameOverOverlay } from "./GameOverOverlay";
import { FloatingTextLayer } from "./FloatingTextLayer";
import { usePixiApp } from "../../features/game/render/usePixiApp";
import { useFruitTextures } from "../../features/game/render/useFruitTextures";
import { useFruitSprites } from "../../features/game/render/useFruitSprites";
import { useParticleSystem } from "../../features/game/render/useParticleSystem";
import { useGameFeedback } from "../../features/game/render/useGameFeedback";
import { useSliceEffects } from "../../features/game/render/useSliceEffects";

interface Props {
  onGameOver?: (result: GameResult) => void;
  muted?: boolean;
  onPlaySlice?: () => void;
  onPlayBomb?: () => void;
}

const GAME_DURATION_SECONDS = GAME_DURATION_MS / 1000;

export function FruitGame({ onGameOver, muted = false, onPlaySlice, onPlayBomb }: Props) {
  const callbacksRef = useRef({ onGameOver, muted, onPlaySlice, onPlayBomb });
  callbacksRef.current = { onGameOver, muted, onPlaySlice, onPlayBomb };
  const { wrapRef, appRef, sizeRef, playLayerRef, trailGraphicsRef, ready } = usePixiApp();
  const { texturesRef, texturesReady } = useFruitTextures({ appRef, appReady: ready });
  const { syncFruitSprites, clearFruitSprites } = useFruitSprites({ playLayerRef, texturesRef, texturesReady, sizeRef });
  const { addParticle, updateParticles, clearParticles } = useParticleSystem();
  const {
    flashRed,
    bombTexts,
    pointTexts,
    triggerBombFeedback,
    triggerPointFeedback,
    updateScreenShake,
    clearFeedback,
  } = useGameFeedback();

  const { showSliceEffect } = useSliceEffects({
    playLayerRef,
    texturesRef,
    sizeRef,
    addParticle,
    triggerBombFeedback,
    triggerPointFeedback,
    callbacksRef,
  });

  const session = useGameSession({
    onGameOver: (result) => callbacksRef.current.onGameOver?.(result),
    onStart: handleStart,
  });

  const {
    countdown,
    running,
    starting,
    finalScore,
    playingRef,
    startedAtRef,
  } = session;

  const { trailPointsRef, addTrailPoint, clearTrail, drawTrail } = useSlashTrail({
    trailGraphicsRef,
  });

  const coreRef = useRef<GameState | null>(null);
  const destroyedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hud, setHud] = useState<HudState>({ score: 0, lives: 3, combo: 0, time: GAME_DURATION_SECONDS });

  function syncHud(state: GameState) {
    setHud({ score: state.score, lives: state.lives, combo: state.combo, time: timeLeftSeconds(state) });
  }

  function finishGame() {
    const state = coreRef.current;
    if (!state) return;
    const playTimeSec = Math.min(180, Math.floor(state.tick / TICK_RATE));
    const result: GameResult = {
      score: state.score,
      playTimeSec,
      endReason: state.endReason ?? undefined,
    };
    session.finishGame(result);
    syncHud(state);
  }

  const handleSliceResult = useCallback((
    results: SliceResult[],
    previousTrail: TrailPoint | undefined,
    screenX: number,
    screenY: number
  ) => {
    const state = coreRef.current;
    if (!state) return;
    for (const result of results) {
      showSliceEffect(result, {
        dx: previousTrail ? screenX - previousTrail.x : 1,
        dy: previousTrail ? screenY - previousTrail.y : 0,
      });
    }
    if (results.length) {
      syncFruitSprites(state);
      syncHud(state);
    }
    if (state.ended) finishGame();
  }, [showSliceEffect, syncFruitSprites, syncHud, finishGame]);

  useGamePointerInput({
    canvasRef,
    gameStateRef: coreRef,
    playingRef,
    startedAtRef,
    sizeRef,
    addTrailPoint,
    clearTrail,
    trailPointsRef,
    onSliceResult: handleSliceResult,
  });

  useGameTicker({
    enabled: ready && texturesReady,
    appRef,
    gameStateRef: coreRef,
    playingRef,
    startedAtRef,
    sizeRef,
    destroyedRef,
    playLayerRef,
    syncFruitSprites,
    updateParticles,
    updateScreenShake,
    drawTrail,
    syncHud,
    finishGame,
  });

  useEffect(() => {
    if (!ready || !texturesReady || !appRef.current || !wrapRef.current) return;
    const app = appRef.current;
    if (!app.canvas) return;

    destroyedRef.current = false;
    canvasRef.current = app.canvas;

    const resizeObserver = new ResizeObserver(() => {
      if (coreRef.current) syncFruitSprites(coreRef.current);
    });
    resizeObserver.observe(wrapRef.current);

    if (!playingRef.current && !countdown) {
      session.startCountdown();
    }

    return () => {
      destroyedRef.current = true;
      resizeObserver.disconnect();

      clearFruitSprites();
      clearParticles();
      clearTrail();
    };
  }, [ready, texturesReady]);

  function handleStart() {
    session.startSession();

    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const seed = values[0] || Date.now();
    const debugTrajectory =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("fruitDebug");
    const config = {
      ...getGameConfig(sizeRef.current.w),
      debugTrajectory,
    };
    coreRef.current = createGame(seed, config);

    clearParticles();
    clearFeedback();
    clearFruitSprites();
    syncHud(coreRef.current);
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={wrapRef} style={{ width: "100%", height: "100%", overflow: "hidden", background: "var(--rice-paper)" }} />
      
      {flashRed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,30,30,.35)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

      <div className="feedbackTextLayer">
        <FloatingTextLayer bombTexts={bombTexts} pointTexts={pointTexts} />
      </div>

      <GameHud hud={hud} running={running} />

      <GameOverOverlay
        finalScore={finalScore}
        running={running}
        countdown={countdown}
        onReplay={session.resetSession}
      />

      <CountdownOverlay countdown={countdown} starting={starting} />
    </div>
  );
}
