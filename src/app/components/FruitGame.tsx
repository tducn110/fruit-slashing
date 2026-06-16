import { useEffect, useRef, useState } from "react";
import {
  Application,
  Container,
  Graphics,
  Sprite,
  Texture,
  Ticker,
} from "pixi.js";

import {
  type FruitKind,
  type Fruit,
  type Particle,
  type TrailPoint,
  COLORS,
  POINTS,
  RADIUS,
  makeFruit,
  makeHalf,
  drawBackground,
} from "../utils/fruit-utils";

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  onGameOver?: (score: number) => void;
}

export function FruitGame({ onGameOver }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stageRef = useRef<Container | null>(null);
  const trailGRef = useRef<Graphics | null>(null);
  const fruitsRef = useRef<Fruit[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<TrailPoint[]>([]);
  const sizeRef = useRef({ w: 800, h: 450 });
  const texturesRef = useRef<Record<string, Texture>>({});

  const GAME_DURATION = 180; // 3 phút — requirement §1.1
  const playingRef = useRef(false);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const comboRef = useRef(0);
  const comboResetRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const timeLeftRef = useRef(GAME_DURATION);
  const gameStartRef = useRef(0);

  const [running, setRunning] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [hud, setHud] = useState({ score: 0, lives: 3, combo: 0, time: GAME_DURATION });

  // ── Init Pixi once ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const app = new Application();
    const initW = Math.max(320, wrap.clientWidth || 800);
    const initH = Math.max(200, wrap.clientHeight || 450);
    sizeRef.current = { w: initW, h: initH };

    app.init({
      width: initW, height: initH,
      background: 0xf5ecd7,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      if (cancelled) { app.destroy(true); return; }
      appRef.current = app;
      wrap.appendChild(app.canvas);
      app.canvas.style.display = "block";
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.touchAction = "none";
      app.canvas.style.cursor = "crosshair";

      // Background layer
      const bgLayer = new Container();
      app.stage.addChild(bgLayer);
      
      const tmpBg = new Container();
      drawBackground(tmpBg, initW, initH);
      const bgTex = app.renderer.generateTexture(tmpBg);
      const bgSprite = new Sprite(bgTex);
      bgLayer.addChild(bgSprite);
      tmpBg.destroy({ children: true });

      // Play layer (fruits + particles + halves)
      const playLayer = new Container();
      app.stage.addChild(playLayer);
      stageRef.current = playLayer;

      // Generate textures for optimization
      const kinds: FruitKind[] = ["durian", "lychee", "banana", "dragonfruit", "mango", "bomb"];
      const tex: Record<string, Texture> = {};
      
      const whiteCircle = new Graphics().circle(0, 0, 10).fill(0xffffff);
      tex["circle"] = app.renderer.generateTexture(whiteCircle);
      whiteCircle.destroy();

      kinds.forEach(k => {
        const r = RADIUS[k];
        const gFull = makeFruit(k, r);
        tex[k] = app.renderer.generateTexture(gFull);
        gFull.destroy();

        if (k !== "bomb") {
          const gLeft = makeHalf(k, r, "left");
          tex[`${k}_left`] = app.renderer.generateTexture(gLeft);
          gLeft.destroy();
          const gRight = makeHalf(k, r, "right");
          tex[`${k}_right`] = app.renderer.generateTexture(gRight);
          gRight.destroy();
        }
      });
      texturesRef.current = tex;

      // Trail layer
      const trailG = new Graphics();
      app.stage.addChild(trailG);
      trailGRef.current = trailG;

      // HUD is rendered as HTML overlay (avoids Pixi text texture-pool bug)

      // Pointer events
      const canvas = app.canvas;
      const onMove = (clientX: number, clientY: number) => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0) return;
        const x = (clientX - rect.left) * (sizeRef.current.w / rect.width);
        const y = (clientY - rect.top)  * (sizeRef.current.h / rect.height);
        trailRef.current.push({ x, y, t: performance.now() });
        if (trailRef.current.length > 18) trailRef.current.shift();
        if (!playingRef.current) return;
        const len = trailRef.current.length;
        if (len < 2) return;
        const p1 = trailRef.current[len - 2];
        const p2 = trailRef.current[len - 1];
        for (const f of fruitsRef.current) {
          if (f.sliced) continue;
          const dx = f.g.x - p2.x;
          const dy = f.g.y - p2.y;
          if (dx * dx + dy * dy < (f.r + 14) ** 2) {
            sliceFruit(f, p2.x - p1.x, p2.y - p1.y);
          }
        }
      };
      const handlePointer = (e: PointerEvent) => onMove(e.clientX, e.clientY);
      canvas.addEventListener("pointermove", handlePointer);
      canvas.addEventListener("pointerdown", handlePointer);

      // Main ticker
      app.ticker.add(tick);

      // Resize observer
      ro.observe(wrap);

      // Cleanup attached below uses these references; nothing else to do here
    }).catch((err) => {
      console.error("Pixi init failed", err);
    });

    const ro = new ResizeObserver(() => {
      if (!appRef.current || !wrap) return;
      const nw = Math.max(320, wrap.clientWidth);
      const nh = Math.max(200, wrap.clientHeight);
      if (nw === sizeRef.current.w && nh === sizeRef.current.h) return;
      sizeRef.current = { w: nw, h: nh };
      appRef.current.renderer.resize(nw, nh);
      const bgLayer = appRef.current.stage.children[0] as Container;
      bgLayer.removeChildren().forEach(child => child.destroy());
      const tmpBg = new Container();
      drawBackground(tmpBg, nw, nh);
      const bgTex = appRef.current.renderer.generateTexture(tmpBg);
      bgLayer.addChild(new Sprite(bgTex));
      tmpBg.destroy({ children: true });
    });

    return () => {
      cancelled = true;
      ro.disconnect();
      app.destroy(true, { children: true });
      appRef.current = null;
      stageRef.current = null;
      trailGRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Per-frame tick ──────────────────────────────────────────────────────────
  function tick(ticker: Ticker) {
    const dt = Math.min(0.05, ticker.deltaMS / 1000);
    const { w: W, h: H } = sizeRef.current;
    const gravity = 1000;

    // Spawn & timer
    if (playingRef.current) {
      const now = performance.now();
      if (gameStartRef.current === 0) gameStartRef.current = now;
      const elapsed = (now - gameStartRef.current) / 1000;
      const newTime = Math.max(0, GAME_DURATION - Math.floor(elapsed));
      if (newTime !== timeLeftRef.current) {
        timeLeftRef.current = newTime;
        syncHud();
        if (newTime <= 0) {
          gameOver();
          return;
        }
      }

      const spawnEvery = Math.max(400, 1200 - scoreRef.current * 8);
      if (now - lastSpawnRef.current > spawnEvery) {
        lastSpawnRef.current = now;
        // Spawn more fruits simultaneously as score increases (max 4)
        const fruitsToSpawn = Math.min(4, 1 + Math.floor(scoreRef.current / 40));
        for (let j = 0; j < fruitsToSpawn; j++) {
          spawnFruit();
        }
      }
      if (comboRef.current > 0 && now > comboResetRef.current) {
        comboRef.current = 0;
        syncHud();
      }
    }

    // Fruits
    for (let i = fruitsRef.current.length - 1; i >= 0; i--) {
      const f = fruitsRef.current[i];
      f.vy += gravity * dt;
      f.g.x += f.vx * dt;
      f.g.y += f.vy * dt;
      f.rot += f.vr * dt;
      f.g.rotation = f.rot;
      
      // Screen bounds bouncing for x-axis
      if (f.g.x < f.r) {
        f.g.x = f.r;
        f.vx *= -1;
      } else if (f.g.x > W - f.r) {
        f.g.x = W - f.r;
        f.vx *= -1;
      }

      if (f.g.y > H + 100) {
        // No penalty for missing fruit — only bombs hurt
        f.g.destroy();
        fruitsRef.current.splice(i, 1);
      }
    }

    // Particles (halves + splatter share)
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.vy += gravity * (p.rotates ? 1 : 0.5) * dt;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      if (p.rotates) {
        p.rot += p.vr * dt;
        p.g.rotation = p.rot;
      }
      
      // Screen bounds bouncing for x-axis
      const pr = (p.g as Sprite).width / 2 || 10;
      if (p.g.x < pr) {
        p.g.x = pr;
        p.vx *= -0.8;
      } else if (p.g.x > W - pr) {
        p.g.x = W - pr;
        p.vx *= -0.8;
      }

      p.life -= dt;
      p.g.alpha = Math.max(0, p.life / p.ttl);
      if (p.life <= 0 || p.g.y > H + 100) {
        p.g.destroy();
        particlesRef.current.splice(i, 1);
      }
    }

    // Trail
    const tg = trailGRef.current;
    if (tg) {
      tg.clear();
      const now = performance.now();
      trailRef.current = trailRef.current.filter((p) => now - p.t < 220);
      if (trailRef.current.length >= 2) {
        for (let i = 1; i < trailRef.current.length; i++) {
          const a = trailRef.current[i - 1];
          const b = trailRef.current[i];
          const age = (now - b.t) / 220;
          const al = 1 - age;
          tg.moveTo(a.x, a.y).lineTo(b.x, b.y)
            .stroke({ color: 0xffffff, width: 7 * al + 1, alpha: al * 0.9, cap: "round" });
          tg.moveTo(a.x, a.y).lineTo(b.x, b.y)
            .stroke({ color: 0xe87432, width: 3 * al + 0.5, alpha: al, cap: "round" });
        }
      }
    }
  }

  // ── Game actions ────────────────────────────────────────────────────────────
  function spawnFruit() {
    const stage = stageRef.current;
    if (!stage) return;
    const { w: W, h: H } = sizeRef.current;
    const bombChance = Math.min(0.25, 0.04 + scoreRef.current * 0.004);
    // durian is rare (5pts), lychee slightly less common
    const pool: FruitKind[] = ["mango", "mango", "banana", "lychee", "dragonfruit", "durian"];
    const kind: FruitKind = Math.random() < bombChance ? "bomb" : pool[Math.floor(Math.random() * pool.length)];
    const r = RADIUS[kind];

    const g = new Sprite(texturesRef.current[kind]);
    g.anchor.set(0.5);
    const startX = Math.max(r, Math.min(W - r, 80 + Math.random() * Math.max(1, W - 160)));
    g.x = startX;
    g.y = H + 40;
    const targetX = Math.max(r, Math.min(W - r, startX + (Math.random() - 0.5) * (W * 0.45)));
    const flightSec = Math.max(0.8, 1.4 - scoreRef.current * 0.003);
    const vx = (targetX - startX) / flightSec;
    const peakY = 80 + Math.random() * (H * 0.2);
    const vy = -Math.sqrt(2 * 1000 * Math.max(50, H - peakY));
    const vr = (Math.random() - 0.5) * 6;
    stage.addChild(g);
    fruitsRef.current.push({ kind, g, vx, vy, rot: 0, vr, r, sliced: false });
  }

  function sliceFruit(f: Fruit, dx: number, dy: number) {
    if (f.sliced) return;
    f.sliced = true;
    const stage = stageRef.current;
    if (!stage) return;
    const angle = Math.atan2(dy, dx);

    if (f.kind === "bomb") {
      // Massive explosion leveraging texture sharing
      spawnSplat(f.g.x, f.g.y, 0xff5a2a, 80, 8);
      spawnSplat(f.g.x, f.g.y, 0xffe66a, 40, 6);
      spawnSplat(f.g.x, f.g.y, 0x1f1f1f, 30, 10);
      livesRef.current = 0;
      updateHud();
      gameOver();
      f.g.destroy();
      const idx = fruitsRef.current.indexOf(f);
      if (idx >= 0) fruitsRef.current.splice(idx, 1);
      return;
    }

    const perp = angle + Math.PI / 2;
    const speed = 220;
    // halves
    (["left", "right"] as const).forEach((side, i) => {
      const half = new Sprite(texturesRef.current[`${f.kind}_${side}`]);
      half.anchor.set(0.5);
      half.x = f.g.x;
      half.y = f.g.y;
      half.rotation = f.g.rotation;
      stage.addChild(half);
      particlesRef.current.push({
        g: half,
        vx: f.vx + Math.cos(perp) * speed * (i === 0 ? -1 : 1),
        vy: f.vy + Math.sin(perp) * speed * (i === 0 ? -1 : 1) - 80,
        rot: f.g.rotation, vr: (i === 0 ? -4 : 4),
        life: 1.4, ttl: 1.4, rotates: true,
      });
    });

    // Spawn massive amount of flesh particles now that they share shapes/textures
    spawnSplat(f.g.x, f.g.y, COLORS[f.kind].flesh, 45, 5);
    spawnSplat(f.g.x, f.g.y, COLORS[f.kind].body, 15, 3);

    comboRef.current += 1;
    comboResetRef.current = performance.now() + 700;
    const base = POINTS[f.kind];
    const mult = comboRef.current >= 5 ? 3 : comboRef.current >= 3 ? 2 : 1;
    scoreRef.current += base * mult;
    updateHud();

    f.g.destroy();
    const idx = fruitsRef.current.indexOf(f);
    if (idx >= 0) fruitsRef.current.splice(idx, 1);
  }

  function spawnSplat(x: number, y: number, color: number, count: number, size: number) {
    const stage = stageRef.current;
    if (!stage) return;
    for (let i = 0; i < count; i++) {
      const g = new Sprite(texturesRef.current["circle"]);
      const r = size * (0.4 + Math.random() * 0.9);
      g.anchor.set(0.5);
      g.tint = color;
      g.width = r * 2;
      g.height = r * 2;
      g.x = x; g.y = y;
      const a = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 220;
      stage.addChild(g);
      const ttl = 0.6 + Math.random() * 0.3;
      particlesRef.current.push({
        g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        rot: 0, vr: 0, life: ttl, ttl, rotates: false,
      });
    }
  }

  function gameOver() {
    playingRef.current = false;
    const fs = scoreRef.current;
    setFinalScore(fs);
    setRunning(false);
    onGameOver?.(fs);
  }

  function syncHud() {
    setHud({ score: scoreRef.current, lives: livesRef.current, combo: comboRef.current, time: timeLeftRef.current });
  }
  const updateHud = syncHud;

  function start() {
    // reset
    fruitsRef.current.forEach((f) => f.g.destroy());
    particlesRef.current.forEach((p) => p.g.destroy());
    fruitsRef.current = [];
    particlesRef.current = [];
    trailRef.current = [];
    scoreRef.current = 0;
    livesRef.current = 3;
    comboRef.current = 0;
    timeLeftRef.current = GAME_DURATION;
    gameStartRef.current = performance.now();
    lastSpawnRef.current = performance.now();
    updateHud();
    setFinalScore(null);
    playingRef.current = true;
    setRunning(true);
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={wrapRef}
        style={{
          width: "100%", height: "100%",
          overflow: "hidden",
          background: "#f5ecd7",
        }}
      />

      {/* HTML HUD overlay */}
      <div style={{
        position: "absolute", top: 14, left: 20, right: 20,
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        pointerEvents: "none",
        fontFamily: "Be Vietnam Pro, sans-serif",
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#2a2418", textShadow: "0 1px 0 rgba(255,255,255,0.6)" }}>
            Điểm: {hud.score}
          </div>
          {hud.combo >= 2 && (
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e87432", marginTop: 4, textShadow: "0 1px 0 rgba(255,255,255,0.6)" }}>
              Combo ×{hud.combo}
              {hud.combo >= 5 ? "  (điểm ×3)" : hud.combo >= 3 ? "  (điểm ×2)" : ""}
            </div>
          )}
        </div>
        {/* Countdown timer — center */}
        {running && (
          <div style={{
            fontSize: 22, fontWeight: 800,
            color: hud.time <= 15 ? "#c23838" : hud.time <= 30 ? "#e87432" : "#2a2418",
            textShadow: "0 1px 0 rgba(255,255,255,0.6)",
            background: "rgba(255,255,255,0.75)",
            borderRadius: 12,
            padding: "4px 16px",
            border: "1.5px solid rgba(138,125,101,0.3)",
          }}>
            {String(Math.floor(hud.time / 60)).padStart(2, "0")}:{String(hud.time % 60).padStart(2, "0")}
          </div>
        )}
        <div style={{ fontSize: 24, fontWeight: 700, color: "#c23838", letterSpacing: 2, textShadow: "0 1px 0 rgba(255,255,255,0.6)" }}>
          {hud.lives > 0 ? "♥".repeat(hud.lives) : "✕"}
        </div>
      </div>
      {!running && (
        <div style={{
          position: "absolute", inset: 0,
          display: "grid", placeItems: "center",
          background: finalScore !== null ? "rgba(245,236,215,0.6)" : "transparent",
          backdropFilter: finalScore !== null ? "blur(2px)" : "none",
          borderRadius: 20,
          pointerEvents: "auto",
        }}>
          <div style={{ textAlign: "center" }}>
            {finalScore !== null && (
              <div style={{
                marginBottom: 18,
                padding: "18px 28px",
                borderRadius: 20,
                background: "rgba(255,255,255,0.9)",
                border: "1.5px solid rgba(138,125,101,0.4)",
                boxShadow: "0 10px 30px rgba(42,36,24,0.15)",
                fontFamily: "Be Vietnam Pro, sans-serif",
              }}>
                <div style={{ fontSize: 13, color: "#8a7d65", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                  Kết thúc
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "#e87432", marginTop: 4 }}>
                  {finalScore} điểm
                </div>
                <div style={{ fontSize: 13, color: "#8a7d65", marginTop: 8 }}>
                  ⏱ {Math.floor((GAME_DURATION - timeLeftRef.current) / 60)} phút {String((GAME_DURATION - timeLeftRef.current) % 60).padStart(2, "0")} giây
                  {" · "}
                  {livesRef.current > 0 ? `${livesRef.current} mạng còn` : "Hết mạng"}
                </div>
              </div>
            )}
            <button
              onClick={start}
              style={{
                padding: "18px 38px",
                background: "linear-gradient(180deg, #f08a48 0%, #e87432 100%)",
                color: "#fff",
                border: "3px solid #b85a22",
                borderRadius: 999,
                fontFamily: "Be Vietnam Pro, sans-serif",
                fontWeight: 800,
                fontSize: 20,
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(232,116,50,0.45)",
              }}
            >
              {finalScore !== null ? "Chơi lại" : "Bắt đầu chém"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


