import { useEffect, useRef, useState } from "react";
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
  timeLeftSeconds,
  type GameState,
  type InputSample,
  type SliceResult,
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

export interface GameResult {
  score: number;
}

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

  const trailRef = useRef<TrailPoint[]>([]);
  const coreRef = useRef<GameState | null>(null);
  const startedAtRef = useRef(0);
  const playingRef = useRef(false);
  const submittedRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [hud, setHud] = useState<HudState>({ score: 0, lives: 3, combo: 0, time: GAME_DURATION_SECONDS });
  const [countdown, setCountdown] = useState<number | null>(null);

  function syncHud(state: GameState) {
    setHud({ score: state.score, lives: state.lives, combo: state.combo, time: timeLeftSeconds(state) });
  }

  function finishGame() {
    const state = coreRef.current;
    if (!state || submittedRef.current) return;
    submittedRef.current = true;
    playingRef.current = false;
    setRunning(false);
    setFinalScore(state.score);
    syncHud(state);
    callbacksRef.current.onGameOver?.({ score: state.score });
  }

  function handlePointer(clientX: number, clientY: number) {
    const app = appRef.current;
    const state = coreRef.current;
    if (!app) return;
    const rect = app.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const screenX = (clientX - rect.left) * (sizeRef.current.w / rect.width);
    const screenY = (clientY - rect.top) * (sizeRef.current.h / rect.height);
    const now = performance.now();
    const previousTrail = trailRef.current.at(-1);
    trailRef.current.push({ x: screenX, y: screenY, t: now });
    if (trailRef.current.length > 18) trailRef.current.shift();
    if (!playingRef.current || !state) return;

    const tick = elapsedTick(now - startedAtRef.current);
    const sample = normalizePointer(screenX, screenY, sizeRef.current.w, sizeRef.current.h, tick);
    const results = applyInput(state, sample);
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
  }

  function tick(ticker: Ticker) {
    const state = coreRef.current;
    if (playingRef.current && state) {
      advanceToTick(state, elapsedTick(performance.now() - startedAtRef.current));
      syncFruitSprites(state);
      if (ticker.lastTime % 250 < ticker.deltaMS) syncHud(state);
      if (state.ended) finishGame();
    }

    updateParticles(ticker.deltaMS / 1000, sizeRef.current.h);

    updateScreenShake(playLayerRef.current);

    const trailGraphics = trailGraphicsRef.current;
    if (trailGraphics) {
      trailGraphics.clear();
      const now = performance.now();
      trailRef.current = trailRef.current.filter((point) => now - point.t < 220);
      for (let index = 1; index < trailRef.current.length; index += 1) {
        const from = trailRef.current[index - 1];
        const to = trailRef.current[index];
        const alpha = 1 - (now - to.t) / 220;
        trailGraphics.moveTo(from.x, from.y).lineTo(to.x, to.y)
          .stroke({ color: 0xffffff, width: 12 * alpha + 3, alpha: alpha * 0.95, cap: "round" });
        trailGraphics.moveTo(from.x, from.y).lineTo(to.x, to.y)
          .stroke({ color: 0xe87432, width: 5 * alpha + 1, alpha, cap: "round" });
      }
    }
  }

  useEffect(() => {
    if (!ready || !texturesReady || !appRef.current || !wrapRef.current) return;
    const app = appRef.current;
    
    const resizeObserver = new ResizeObserver(() => {
      if (coreRef.current) syncFruitSprites(coreRef.current);
    });
    resizeObserver.observe(wrapRef.current);

    const pointerHandler = (event: PointerEvent) => handlePointer(event.clientX, event.clientY);
    app.canvas.addEventListener("pointermove", pointerHandler);
    app.canvas.addEventListener("pointerdown", pointerHandler);

    app.ticker.add(tick);

    if (!playingRef.current && !countdown) {
      beginCountdown();
    }

    return () => {
      resizeObserver.disconnect();
      app.canvas.removeEventListener("pointermove", pointerHandler);
      app.canvas.removeEventListener("pointerdown", pointerHandler);
      app.ticker.remove(tick);

      clearFruitSprites();
      clearParticles();
    };
  }, [ready, texturesReady]);

  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      const seed = values[0] || Date.now();
      coreRef.current = createGame(seed);
      submittedRef.current = false;
      clearParticles();
      clearFeedback();
      clearFruitSprites();
      startedAtRef.current = performance.now();
      playingRef.current = true;
      setFinalScore(null);
      setRunning(true);
      setCountdown(null);
      syncHud(coreRef.current);
    } finally {
      setStarting(false);
    }
  }

  function beginCountdown() {
    if (!starting) setCountdown(3);
  }

  useEffect(() => {
    if (!running && finalScore === null && countdown === null) beginCountdown();
  }, []);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => {
      if (countdown === 1) void start();
      else setCountdown(countdown - 1);
    }, 700);
    return () => clearTimeout(timer);
  }, [countdown]);

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
        onReplay={beginCountdown}
      />

      <CountdownOverlay countdown={countdown} starting={starting} />
    </div>
  );
}
