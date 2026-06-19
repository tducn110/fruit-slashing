import { useEffect, useRef, useState, useCallback } from "react";
import { Application, Container, Graphics, Sprite, Texture, Ticker } from "pixi.js";
import {
  GAME_DURATION_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  advanceToTick,
  applyInput,
  createGame,
  elapsedTick,
  normalizePointer,
  screenToWorld,
  timeLeftSeconds,
  getGameConfig,
  TICK_RATE,
  type GameState,
  type InputSample,
  type SliceResult,
  type TrailSegment,
} from "../../game/core";
import {
  type FruitKind,
  type Particle,
  type TrailPoint,
  COLORS,
  RADIUS,
  makeFruit,
  makeHalf,
  drawBackground,
} from "../../utils/fruit-utils";
import type { GameResult } from "../../game/types";
import { useGameSession } from "../../features/game/runtime/useGameSession";
import { useSlashTrail } from "../../features/game/input/useSlashTrail";
import { useGamePointerInput } from "../../features/game/input/useGamePointerInput";

interface Props {
  onGameOver?: (result: GameResult) => void;
  muted?: boolean;
  onPlaySlice?: () => void;
  onPlayBomb?: () => void;
}

import { GameHud, type HudState } from "./GameHud";
import { CountdownOverlay } from "./CountdownOverlay";
import { GameOverOverlay } from "./GameOverOverlay";
import { FloatingTextLayer, type BombText, type PointText } from "./FloatingTextLayer";
import { usePixiApp } from "../../features/game/render/usePixiApp";
import { useFruitTextures } from "../../features/game/render/useFruitTextures";
import { useFruitSprites } from "../../features/game/render/useFruitSprites";
import { useParticleSystem } from "../../features/game/render/useParticleSystem";
import { useGameFeedback } from "../../features/game/render/useGameFeedback";
import { useSliceEffects } from "../../features/game/render/useSliceEffects";

const GAME_DURATION_SECONDS = GAME_DURATION_MS / 1000;
const FRUIT_KINDS: FruitKind[] = ["durian", "lychee", "banana", "dragonfruit", "mango", "peanut", "bomb"];

export function FruitGame({ onGameOver, muted = false, onPlaySlice, onPlayBomb }: Props) {
  const callbacksRef = useRef({ onGameOver, muted, onPlaySlice, onPlayBomb });
  callbacksRef.current = { onGameOver, muted, onPlaySlice, onPlayBomb };
  const { wrapRef, appRef, sizeRef, playLayerRef, trailGraphicsRef, ready } = usePixiApp();
  const { texturesRef, texturesReady } = useFruitTextures({ appRef, appReady: ready });
  const { syncFruitSprites, clearFruitSprites } = useFruitSprites({ playLayerRef, texturesRef, sizeRef });
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

  function tick(ticker: Ticker) {
    if (destroyedRef.current) return;
    const state = coreRef.current;
    if (playingRef.current && state) {
      advanceToTick(state, elapsedTick(performance.now() - startedAtRef.current));
      syncFruitSprites(state);
      if (ticker.lastTime % 250 < ticker.deltaMS) syncHud(state);
      if (state.ended) finishGame();
    }

    updateParticles(ticker.deltaMS / 1000, sizeRef.current.h);

    updateScreenShake(playLayerRef.current);

    drawTrail();
  }

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

    app.ticker.add(tick);

    if (!playingRef.current && !countdown) {
      session.startCountdown();
    }

    return () => {
      destroyedRef.current = true;
      resizeObserver.disconnect();

      if (app?.ticker) {
        app.ticker.remove(tick);
      }

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
    console.log('[FruitGame] viewport width:', sizeRef.current.w, 'config:', config);
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

      <FloatingTextLayer bombTexts={bombTexts} pointTexts={pointTexts} />

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
