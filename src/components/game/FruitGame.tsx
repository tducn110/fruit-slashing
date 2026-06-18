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

const GAME_DURATION_SECONDS = GAME_DURATION_MS / 1000;
const FRUIT_KINDS: FruitKind[] = ["durian", "lychee", "banana", "dragonfruit", "mango", "peanut", "bomb"];

export function FruitGame({ onGameOver, muted = false, onPlaySlice, onPlayBomb }: Props) {
  const callbacksRef = useRef({ onGameOver, muted, onPlaySlice, onPlayBomb });
  callbacksRef.current = { onGameOver, muted, onPlaySlice, onPlayBomb };
  const { wrapRef, appRef, sizeRef, playLayerRef, trailGraphicsRef, ready } = usePixiApp();
  const texturesRef = useRef<Record<string, Texture>>({});
  const spriteMapRef = useRef(new Map<number, Sprite>());
  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const coreRef = useRef<GameState | null>(null);
  const startedAtRef = useRef(0);
  const playingRef = useRef(false);
  const submittedRef = useRef(false);
  const shakeRef = useRef({ active: false, startedAt: 0 });

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [hud, setHud] = useState<HudState>({ score: 0, lives: 3, combo: 0, time: GAME_DURATION_SECONDS });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashRed, setFlashRed] = useState(false);
  const [bombTexts, setBombTexts] = useState<BombText[]>([]);
  const [pointTexts, setPointTexts] = useState<PointText[]>([]);
  const effectIdRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  function schedule(callback: () => void, delay: number) {
    const timer = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((id) => id !== timer);
      callback();
    }, delay);

    timersRef.current.push(timer);
    return timer;
  }

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  function worldToScreen(x: number, y: number) {
    return {
      x: (x / WORLD_WIDTH) * sizeRef.current.w,
      y: (y / WORLD_HEIGHT) * sizeRef.current.h,
    };
  }

  function renderScale(): number {
    return Math.min(sizeRef.current.w / WORLD_WIDTH, sizeRef.current.h / WORLD_HEIGHT);
  }

  function syncHud(state: GameState) {
    setHud({ score: state.score, lives: state.lives, combo: state.combo, time: timeLeftSeconds(state) });
  }

  function syncFruitSprites(state: GameState) {
    const layer = playLayerRef.current;
    if (!layer) return;
    const activeIds = new Set<number>();
    const scale = renderScale();
    for (const fruit of state.fruits) {
      activeIds.add(fruit.id);
      let sprite = spriteMapRef.current.get(fruit.id);
      if (!sprite) {
        sprite = new Sprite(texturesRef.current[fruit.kind]);
        sprite.anchor.set(0.5);
        spriteMapRef.current.set(fruit.id, sprite);
        layer.addChild(sprite);
      }
      const screen = worldToScreen(fruit.x, fruit.y);
      sprite.position.set(screen.x, screen.y);
      sprite.rotation = fruit.rotation;
      sprite.scale.set(scale);
    }
    for (const [id, sprite] of spriteMapRef.current) {
      if (activeIds.has(id)) continue;
      sprite.destroy();
      spriteMapRef.current.delete(id);
    }
  }

  function spawnSplat(x: number, y: number, color: number, count: number, size: number) {
    const layer = playLayerRef.current;
    if (!layer) return;
    for (let index = 0; index < count; index += 1) {
      const particle = new Sprite(texturesRef.current.circle);
      particle.anchor.set(0.5);
      particle.tint = color;
      const radius = size * (0.4 + Math.random() * 0.9);
      particle.width = radius * 2;
      particle.height = radius * 2;
      particle.position.set(x, y);
      layer.addChild(particle);
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 220;
      const ttl = 0.6 + Math.random() * 0.3;
      particlesRef.current.push({
        g: particle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        rot: 0,
        vr: 0,
        life: ttl,
        ttl,
        rotates: false,
      });
    }
  }

  function showSliceEffect(result: SliceResult, direction: { dx: number; dy: number }) {
    const layer = playLayerRef.current;
    if (!layer) return;
    const screen = worldToScreen(result.fruit.x, result.fruit.y);
    if (result.fruit.kind === "bomb") {
      spawnSplat(screen.x, screen.y, 0xff5a2a, 80, 8);
      spawnSplat(screen.x, screen.y, 0xffe66a, 40, 6);
      spawnSplat(screen.x, screen.y, 0x1f1f1f, 30, 10);
      shakeRef.current = { active: true, startedAt: performance.now() };
      setFlashRed(true);
      schedule(() => setFlashRed(false), 100);
      const id = ++effectIdRef.current;
      setBombTexts((items) => [...items.slice(-4), { ...screen, id }]);
      schedule(() => {
        setBombTexts((items) => items.filter((item) => item.id !== id));
      }, 800);
      if (!callbacksRef.current.muted) callbacksRef.current.onPlayBomb?.();
      return;
    }

    const angle = Math.atan2(direction.dy, direction.dx);
    const perpendicular = angle + Math.PI / 2;
    const splitSpeed = 220;
    const scale = renderScale();
    (["left", "right"] as const).forEach((side, index) => {
      const half = new Sprite(texturesRef.current[`${result.fruit.kind}_${side}`]);
      half.anchor.set(0.5);
      half.position.set(screen.x, screen.y);
      half.rotation = result.fruit.rotation;
      half.scale.set(scale);
      layer.addChild(half);
      particlesRef.current.push({
        g: half,
        vx: result.fruit.vx * (sizeRef.current.w / WORLD_WIDTH) + Math.cos(perpendicular) * splitSpeed * (index === 0 ? -1 : 1),
        vy: result.fruit.vy * (sizeRef.current.h / WORLD_HEIGHT) + Math.sin(perpendicular) * splitSpeed * (index === 0 ? -1 : 1) - 80,
        rot: result.fruit.rotation,
        vr: index === 0 ? -4 : 4,
        life: 1.4,
        ttl: 1.4,
        rotates: true,
      });
    });
    spawnSplat(screen.x, screen.y, COLORS[result.fruit.kind].flesh, 45, 5);
    spawnSplat(screen.x, screen.y, COLORS[result.fruit.kind].body, 15, 3);
    const id = ++effectIdRef.current;
    setPointTexts((items) => [...items.slice(-8), {
      ...screen,
      id,
      text: result.fruit.kind === "peanut" ? `+${result.points} SIÊU HIẾM!` : `+${result.points}`,
      color: result.fruit.kind === "peanut" ? "var(--mascot-yellow)" : "var(--primary)",
    }]);
    schedule(() => {
      setPointTexts((items) => items.filter((item) => item.id !== id));
    }, 800);
    if (!callbacksRef.current.muted) callbacksRef.current.onPlaySlice?.();
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

    const deltaSeconds = Math.min(0.05, ticker.deltaMS / 1000);
    for (let index = particlesRef.current.length - 1; index >= 0; index -= 1) {
      const particle = particlesRef.current[index];
      particle.vy += 1000 * (particle.rotates ? 1 : 0.5) * deltaSeconds;
      particle.g.x += particle.vx * deltaSeconds;
      particle.g.y += particle.vy * deltaSeconds;
      if (particle.rotates) {
        particle.rot += particle.vr * deltaSeconds;
        particle.g.rotation = particle.rot;
      }
      particle.life -= deltaSeconds;
      particle.g.alpha = Math.max(0, particle.life / particle.ttl);
      if (particle.life <= 0 || particle.g.y > sizeRef.current.h + 100) {
        particle.g.destroy();
        particlesRef.current.splice(index, 1);
      }
    }

    const layer = playLayerRef.current;
    if (shakeRef.current.active && layer) {
      const elapsed = (performance.now() - shakeRef.current.startedAt) / 400;
      if (elapsed >= 1) {
        shakeRef.current.active = false;
        layer.position.set(0, 0);
      } else {
        const amount = 8 * (1 - elapsed);
        layer.position.set((Math.random() - 0.5) * amount * 2, (Math.random() - 0.5) * amount * 2);
      }
    }

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
    if (!ready || !appRef.current || !wrapRef.current) return;
    const app = appRef.current;
    
    const textures: Record<string, Texture> = {};
    const circle = new Graphics().circle(0, 0, 10).fill(0xffffff);
    textures.circle = app.renderer.generateTexture(circle);
    circle.destroy();
    for (const kind of FRUIT_KINDS) {
      const full = makeFruit(kind, RADIUS[kind]);
      textures[kind] = app.renderer.generateTexture(full);
      full.destroy();
      if (kind !== "bomb") {
        for (const side of ["left", "right"] as const) {
          const half = makeHalf(kind, RADIUS[kind], side);
          textures[`${kind}_${side}`] = app.renderer.generateTexture(half);
          half.destroy();
        }
      }
    }
    texturesRef.current = textures;

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

      for (const tex of Object.values(texturesRef.current)) tex.destroy(true);
      texturesRef.current = {};
      spriteMapRef.current.forEach((sprite) => sprite.destroy());
      spriteMapRef.current.clear();
      particlesRef.current.forEach((particle) => particle.g.destroy());
      particlesRef.current = [];
    };
  }, [ready]);

  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      const seed = values[0] || Date.now();
      coreRef.current = createGame(seed);
      submittedRef.current = false;
      particlesRef.current.forEach((particle) => particle.g.destroy());
      particlesRef.current = [];
      spriteMapRef.current.forEach((sprite) => sprite.destroy());
      spriteMapRef.current.clear();
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
