import { useEffect, useRef, useState, useCallback } from "react";
import {
  createGame,
  getGameConfig,
  TICK_RATE,
  type GameState,
  type SliceResult,
} from "../../game/core";
import {
  finalizeGameResult,
  type GameResult,
} from "../../game/types";
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
import { getFxPreset } from "../../features/game/render/fxPreset";
import { PauseOverlay } from "./PauseOverlay";

interface Props {
  onSubmitScore?: (result: GameResult) => void;
  onCompleteRound?: (result: GameResult) => void;
  onExitGame?: () => void;
  onGameStart?: () => void;
  onRunStateChange?: (active: boolean) => void;
  manualPaused?: boolean;
  resumeRequired?: boolean;
  restartKey?: number;
  hostPaused?: boolean;
  muted?: boolean;
  onPlaySlice?: () => void;
  onPlayBomb?: () => void;
  musicMuted?: boolean;
  sfxMuted?: boolean;
  onToggleMusic?: () => void;
  onToggleSfx?: () => void;
  onResumePause?: () => void;
  onRestartPause?: () => void;
}

export function FruitGame({ onSubmitScore, onCompleteRound, onExitGame, onGameStart, onRunStateChange, hostPaused = false, manualPaused = false, resumeRequired = false, restartKey = 0, muted = false, onPlaySlice, onPlayBomb, musicMuted = false, sfxMuted = false, onToggleMusic, onToggleSfx, onResumePause, onRestartPause }: Props) {
  const callbacksRef = useRef({ onSubmitScore, onCompleteRound, onExitGame, onGameStart, muted, onPlaySlice, onPlayBomb });
  callbacksRef.current = { onSubmitScore, onCompleteRound, onExitGame, onGameStart, muted, onPlaySlice, onPlayBomb };
  const { wrapRef, appRef, sizeRef, playLayerRef, trailGraphicsRef, ready } = usePixiApp();
  const getCurrentFxPreset = useCallback(() => getFxPreset(sizeRef.current.w), [sizeRef]);
  const { texturesRef, texturesReady } = useFruitTextures({ appRef, appReady: ready });
  const { syncFruitSprites, clearFruitSprites } = useFruitSprites({ playLayerRef, texturesRef, texturesReady, sizeRef });
  const { addParticle, updateParticles, clearParticles, initPool, spawnPooledParticle } = useParticleSystem({
    getMaxParticles: () => getCurrentFxPreset().maxParticles,
  });
  const {
    flashRed,
    bombTexts,
    pointTexts,
    triggerBombFeedback,
    triggerPointFeedback,
    updateScreenShake,
    clearFeedback,
  } = useGameFeedback();

  const { showSliceEffect, destroySlashPool } = useSliceEffects({
    playLayerRef,
    texturesRef,
    sizeRef,
    addParticle,
    spawnPooledParticle,
    triggerBombFeedback,
    triggerPointFeedback,
    callbacksRef,
  });

  const session = useGameSession({
    hostPaused,
    manualPaused,
    resumeRequired,
    onStart: handleStart,
    onComplete: (result) => callbacksRef.current.onCompleteRound?.(result),
  });

  const {
    countdown,
    running,
    starting,
    finalScore,
    finalResult,
    playingRef,
    startedAtRef,
    hostPausedRef,
  } = session;

  useEffect(() => {
    onRunStateChange?.(running || countdown !== null);
  }, [running, countdown, onRunStateChange]);

  const coreRef = useRef<GameState | null>(null);
  const destroyedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [reviveUsed, setReviveUsed] = useState(false);
  const [gameOverMode, setGameOverMode] = useState<"continue" | "summary">("continue");
  const [scoreMultiplier, setScoreMultiplier] = useState(1);
  const finalizeSentRef = useRef(false);

  const { trailPointsRef, addTrailPoint, clearTrail, drawTrail } = useSlashTrail({
    trailGraphicsRef,
    getMaxPoints: () => getCurrentFxPreset().trailPoints,
  });

  const [hud, setHud] = useState<HudState>({ score: 0, lives: 3, combo: 0 });

  function syncHud(state: GameState) {
    setHud({ score: state.score, lives: state.lives, combo: state.combo });
  }

  function finishGame() {
    const state = coreRef.current;
    if (!state) return;
    const playTimeSec = Math.floor(state.tick / TICK_RATE);
    const result: GameResult = {
      score: state.score,
      playTimeSec,
      endReason: state.endReason ?? undefined,
    };
    session.finishGame(result);
    syncHud(state);
    setScoreMultiplier(1);
    setGameOverMode(!reviveUsed && result.endReason === "lives" ? "continue" : "summary");
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
    paused: hostPaused || manualPaused || resumeRequired,
    appRef,
    gameStateRef: coreRef,
    playingRef,
    startedAtRef,
    hostPausedRef,
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

    // Phase 2.1: Initialise particle pool now that textures + layer are ready.
    const layer = playLayerRef.current;
    const circleTexture = texturesRef.current["circle"];
    if (layer && circleTexture) {
      const preset = getCurrentFxPreset();
      initPool(layer, circleTexture, preset.maxParticles);
    }

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
      destroySlashPool();
    };
  }, [ready, texturesReady]);

  function handleRevive() {
    const state = coreRef.current;
    if (!state || !state.ended || state.endReason !== "lives" || reviveUsed) return;

    setReviveUsed(true);
    setScoreMultiplier(1);
    setGameOverMode("summary");
    state.ended = false;
    state.endReason = null;
    state.lives = 3;
    state.combo = 0;
    state.comboExpiresAtTick = state.tick;
    state.fruits = [];
    state.lastPointer = null;
    state.nextSpawnTick = state.tick + Math.round(0.7 * TICK_RATE);

    clearParticles();
    clearFeedback();
    clearFruitSprites();
    clearTrail();
    syncHud(state);
    session.resumeSession((state.tick / TICK_RATE) * 1000);
    callbacksRef.current.onGameStart?.();
  }

  const lastRestartKeyRef = useRef(restartKey);
  useEffect(() => {
    if (restartKey === lastRestartKeyRef.current) return;
    lastRestartKeyRef.current = restartKey;
    const state = coreRef.current;
    if (state) {
      state.ended = false;
      state.endReason = null;
      state.fruits = [];
      state.lastPointer = null;
      state.lives = 3;
      state.combo = 0;
      state.comboExpiresAtTick = state.tick;
      state.nextSpawnTick = state.tick + Math.round(0.7 * TICK_RATE);
      clearParticles();
      clearFeedback();
      clearFruitSprites();
      clearTrail();
      syncHud(state);
    }
    setReviveUsed(false);
    setScoreMultiplier(1);
    setGameOverMode("continue");
    session.resetSession();
  }, [restartKey]);

  function handleDeclineContinue() {
    setScoreMultiplier(1);
    setGameOverMode("summary");
  }

  function handleDoubleScore() {
    setScoreMultiplier(2);
  }

  function finalizeGame() {
    if (!finalResult || finalizeSentRef.current) return;
    finalizeSentRef.current = true;
    callbacksRef.current.onSubmitScore?.(
      finalizeGameResult(finalResult, scoreMultiplier),
    );
    callbacksRef.current.onExitGame?.();
  }

  function handleStart() {
    session.startSession();
    finalizeSentRef.current = false;
    setReviveUsed(false);
    setGameOverMode("continue");
    setScoreMultiplier(1);
    callbacksRef.current.onGameStart?.();

    let seed = Date.now();
    try {
      if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        const values = new Uint32Array(1);
        crypto.getRandomValues(values);
        if (values[0]) seed = values[0];
      }
    } catch {
      // Ignore
    }
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
        displayScore={finalResult ? finalResult.score * scoreMultiplier : finalScore}
        running={running}
        countdown={countdown}
        mode={gameOverMode}
        canContinue={!reviveUsed && finalResult?.endReason === "lives"}
        canDoubleScore={scoreMultiplier === 1}
        onContinue={handleRevive}
        onDeclineContinue={handleDeclineContinue}
        onDoubleScore={handleDoubleScore}
        onEndGame={finalizeGame}
      />

      <CountdownOverlay countdown={countdown} starting={starting} />

      <PauseOverlay
        visible={manualPaused || resumeRequired || hostPaused}
        musicMuted={musicMuted}
        sfxMuted={sfxMuted}
        onResume={onResumePause ?? (() => undefined)}
        onRestart={onRestartPause ?? (() => undefined)}
        onToggleMusic={onToggleMusic ?? (() => undefined)}
        onToggleSfx={onToggleSfx ?? (() => undefined)}
      />
    </div>
  );
}
