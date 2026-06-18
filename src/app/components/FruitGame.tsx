import { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Sprite, Texture, Ticker } from "pixi.js";
import {
  GAME_DURATION_MS,
  MAX_INPUT_SAMPLES,
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
} from "../utils/fruit-utils";

export interface GameSession {
  sessionId: string | null;
  seed: number;
}

export interface GameResult {
  sessionId: string | null;
  score: number;
  inputLog: InputSample[];
}

interface Props {
  onGameStart?: () => Promise<GameSession>;
  onGameOver?: (result: GameResult) => void;
  muted?: boolean;
  onPlaySlice?: () => void;
  onPlayBomb?: () => void;
}

interface HudState {
  score: number;
  lives: number;
  combo: number;
  time: number;
}

const GAME_DURATION_SECONDS = GAME_DURATION_MS / 1000;
const FRUIT_KINDS: FruitKind[] = ["durian", "lychee", "banana", "dragonfruit", "mango", "peanut", "bomb"];

function localSession(): GameSession {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return { sessionId: null, seed: values[0] || Date.now() };
}

export function FruitGame({ onGameStart, onGameOver, muted = false, onPlaySlice, onPlayBomb }: Props) {
  const callbacksRef = useRef({ onGameStart, onGameOver, muted, onPlaySlice, onPlayBomb });
  callbacksRef.current = { onGameStart, onGameOver, muted, onPlaySlice, onPlayBomb };
  const wrapRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const playLayerRef = useRef<Container | null>(null);
  const trailGraphicsRef = useRef<Graphics | null>(null);
  const texturesRef = useRef<Record<string, Texture>>({});
  const spriteMapRef = useRef(new Map<number, Sprite>());
  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const sizeRef = useRef({ w: 800, h: 450 });
  const coreRef = useRef<GameState | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const inputLogRef = useRef<InputSample[]>([]);
  const startedAtRef = useRef(0);
  const playingRef = useRef(false);
  const submittedRef = useRef(false);
  const lastLoggedTickRef = useRef(-1);
  const shakeRef = useRef({ active: false, startedAt: 0 });

  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [hud, setHud] = useState<HudState>({ score: 0, lives: 3, combo: 0, time: GAME_DURATION_SECONDS });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashRed, setFlashRed] = useState(false);
  const [bombTexts, setBombTexts] = useState<{ x: number; y: number; id: number }[]>([]);
  const [pointTexts, setPointTexts] = useState<{ x: number; y: number; id: number; text: string; color: string }[]>([]);
  const effectIdRef = useRef(0);

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
      setTimeout(() => setFlashRed(false), 100);
      const id = ++effectIdRef.current;
      setBombTexts((items) => [...items.slice(-4), { ...screen, id }]);
      setTimeout(() => setBombTexts((items) => items.filter((item) => item.id !== id)), 800);
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
      color: result.fruit.kind === "peanut" ? "#ff8c00" : "#e87432",
    }]);
    setTimeout(() => setPointTexts((items) => items.filter((item) => item.id !== id)), 800);
    if (!callbacksRef.current.muted) callbacksRef.current.onPlaySlice?.();
  }

  function finishGame() {
    const state = coreRef.current;
    const session = sessionRef.current;
    if (!state || !session || submittedRef.current) return;
    submittedRef.current = true;
    playingRef.current = false;
    setRunning(false);
    setFinalScore(state.score);
    syncHud(state);
    callbacksRef.current.onGameOver?.({ sessionId: session.sessionId, score: state.score, inputLog: [...inputLogRef.current] });
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
    if (tick - lastLoggedTickRef.current < 2 || inputLogRef.current.length >= MAX_INPUT_SAMPLES) return;
    const sample = normalizePointer(screenX, screenY, sizeRef.current.w, sizeRef.current.h, tick);
    lastLoggedTickRef.current = tick;
    inputLogRef.current.push(sample);
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
    let cancelled = false;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const app = new Application();
    const width = Math.max(320, wrap.clientWidth || 800);
    const height = Math.max(200, wrap.clientHeight || 450);
    sizeRef.current = { w: width, h: height };
    const resizeObserver = new ResizeObserver(() => {
      if (!appRef.current) return;
      const nextWidth = Math.max(320, wrap.clientWidth);
      const nextHeight = Math.max(200, wrap.clientHeight);
      if (nextWidth === sizeRef.current.w && nextHeight === sizeRef.current.h) return;
      sizeRef.current = { w: nextWidth, h: nextHeight };
      appRef.current.renderer.resize(nextWidth, nextHeight);
      const backgroundLayer = appRef.current.stage.children[0] as Container;
      backgroundLayer.removeChildren().forEach((child) => child.destroy());
      const background = new Container();
      drawBackground(background, nextWidth, nextHeight);
      backgroundLayer.addChild(new Sprite(appRef.current.renderer.generateTexture(background)));
      background.destroy({ children: true });
      if (coreRef.current) syncFruitSprites(coreRef.current);
    });

    app.init({ width, height, background: 0xf5ecd7, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true })
      .then(() => {
        if (cancelled) {
          app.destroy(true);
          return;
        }
        appRef.current = app;
        wrap.appendChild(app.canvas);
        Object.assign(app.canvas.style, { display: "block", width: "100%", height: "100%", touchAction: "none", cursor: "crosshair" });

        const backgroundLayer = new Container();
        const background = new Container();
        drawBackground(background, width, height);
        backgroundLayer.addChild(new Sprite(app.renderer.generateTexture(background)));
        background.destroy({ children: true });
        app.stage.addChild(backgroundLayer);

        const playLayer = new Container();
        app.stage.addChild(playLayer);
        playLayerRef.current = playLayer;

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

        const trailGraphics = new Graphics();
        app.stage.addChild(trailGraphics);
        trailGraphicsRef.current = trailGraphics;
        const pointerHandler = (event: PointerEvent) => handlePointer(event.clientX, event.clientY);
        app.canvas.addEventListener("pointermove", pointerHandler);
        app.canvas.addEventListener("pointerdown", pointerHandler);
        app.ticker.add(tick);
        resizeObserver.observe(wrap);
      })
      .catch((error) => console.error("Pixi init failed", error));

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      app.destroy(true, { children: true });
      appRef.current = null;
      playLayerRef.current = null;
      trailGraphicsRef.current = null;
      spriteMapRef.current.clear();
    };
  }, []);

  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      const createSession = callbacksRef.current.onGameStart;
      const session = createSession ? await createSession() : localSession();
      sessionRef.current = session;
      coreRef.current = createGame(session.seed);
      inputLogRef.current = [];
      lastLoggedTickRef.current = -1;
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
      <div ref={wrapRef} style={{ width: "100%", height: "100%", overflow: "hidden", background: "#f5ecd7" }} />
      {flashRed && <div style={{ position: "absolute", inset: 0, background: "rgba(255,30,30,.35)", pointerEvents: "none", zIndex: 5 }} />}
      {bombTexts.map((text) => (
        <div key={text.id} className="bombText" style={{ left: text.x, top: text.y }}>BÙM!</div>
      ))}
      {pointTexts.map((text) => (
        <div key={text.id} className="pointText" style={{ left: text.x, top: text.y, color: text.color }}>{text.text}</div>
      ))}

      <div className="gameHud">
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Điểm: {hud.score}</div>
          {hud.combo >= 2 && <div className="comboText">{hud.combo >= 5 ? "BẠO KÍCH: " : ""}Combo ×{hud.combo}</div>}
        </div>
        {running && <div className={`gameTimer ${hud.time <= 15 ? "danger" : ""}`}>{String(Math.floor(hud.time / 60)).padStart(2, "0")}:{String(hud.time % 60).padStart(2, "0")}</div>}
        <div className="gameLives">{hud.lives > 0 ? "♥".repeat(hud.lives) : "✕"}</div>
      </div>

      {!running && countdown === null && finalScore !== null && (
        <div className="gameOverOverlay">
          <div style={{ textAlign: "center" }}>
            <div className="scoreCard">
              <div className="scoreLabel">Kết thúc</div>
              <div className="scoreValue">{finalScore} điểm</div>
              <div className="scoreMeta">{sessionRef.current?.sessionId ? "Đang xác minh điểm…" : "Chơi khách · điểm không xếp hạng"}</div>
            </div>
            <button onClick={beginCountdown} className="replayButton">Chơi lại</button>
          </div>
        </div>
      )}

      {(countdown !== null || starting) && (
        <div className="countdownOverlay"><div className="countdownNumber">{starting ? "…" : countdown}</div></div>
      )}

      <style>{`
        .gameHud { position:absolute; top:14px; left:20px; right:20px; display:flex; justify-content:space-between; align-items:flex-start; pointer-events:none; font-family:'Be Vietnam Pro',sans-serif; z-index:8; color:#2a2418; text-shadow:0 1px 0 rgba(255,255,255,.6) }
        .comboText { font-size:18px; font-weight:800; color:#e87432; margin-top:4px }
        .gameTimer { font-size:22px; font-weight:800; background:rgba(255,255,255,.75); border-radius:12px; padding:4px 16px; border:1.5px solid rgba(138,125,101,.3) }
        .gameTimer.danger { color:#c23838 }
        .gameLives { font-size:24px; font-weight:700; color:#c23838; letter-spacing:2px }
        .bombText,.pointText { position:absolute; transform:translate(-50%,-50%); pointer-events:none; z-index:10; font-family:'Be Vietnam Pro',sans-serif; font-weight:900; animation:pointPop .8s ease-out forwards }
        .bombText { font-size:clamp(24px,6vw,52px); color:#ff2a2a; text-shadow:0 4px 16px rgba(255,0,0,.7) }
        .pointText { font-size:clamp(18px,4vw,36px); text-shadow:0 2px 4px rgba(42,36,24,.8) }
        .gameOverOverlay,.countdownOverlay { position:absolute; inset:0; display:grid; place-items:center; background:rgba(245,236,215,.72); backdrop-filter:blur(4px); z-index:50; font-family:'Be Vietnam Pro',sans-serif }
        .scoreCard { margin-bottom:18px; padding:18px 28px; border-radius:20px; background:rgba(255,255,255,.9); border:1.5px solid rgba(138,125,101,.4); box-shadow:0 10px 30px rgba(42,36,24,.15) }
        .scoreLabel { font-size:13px; color:#8a7d65; font-weight:700; letter-spacing:1px; text-transform:uppercase }
        .scoreValue { font-size:36px; font-weight:800; color:#e87432; margin-top:4px }
        .scoreMeta { font-size:13px; color:#8a7d65; margin-top:8px }
        .replayButton { padding:18px 38px; background:linear-gradient(180deg,#f08a48,#e87432); color:#fff; border:3px solid #b85a22; border-radius:999px; font-family:inherit; font-weight:800; font-size:20px; cursor:pointer; box-shadow:0 10px 24px rgba(232,116,50,.45) }
        .countdownNumber { font-size:clamp(80px,18vw,160px); font-weight:900; color:#e87432; animation:countPop .6s ease-out }
        @keyframes countPop { from { transform:scale(2); opacity:0 } to { transform:scale(1); opacity:1 } }
        @keyframes pointPop { 0% { opacity:1; transform:translate(-50%,-50%) scale(.7) } 100% { opacity:0; transform:translate(-50%,-80%) scale(1) } }
      `}</style>
    </div>
  );
}
