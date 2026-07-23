/**
 * useSliceEffects — Handles Pixi-side visual responses to slice/bomb events.
 *
 * Performance notes (Phase 2):
 * - Splat particles: delegated to useParticleSystem pool via spawnPooledParticle().
 *   No new Sprite() created per splat; pool slot is reset and reused.
 * - Slash Graphics: small pool of SLASH_POOL_SIZE pre-allocated Graphics objects.
 *   Rounds-robin through them; each is cleared + redrawn on use, never destroyed
 *   until unmount. Tracked in legacyRef (via addParticle) for alpha fade.
 * - Fruit halves: still use new Sprite() per event. Texture switching per fruit
 *   kind makes pooling risky (texture mismatch bugs). They go through the legacy
 *   addParticle path and are destroyed when they fall off-screen. Low frequency
 *   (max 2 per slice) so GC impact is acceptable.
 * - Scoring, gameplay rules, hitbox: unchanged.
 */
import { useRef } from "react";
import { type Container, Graphics, Sprite, type Texture } from "pixi.js";
import { getWorldRenderTransform, worldToScreen as projectWorldToScreen, type SliceResult } from "../../../game/core";
import { FRUIT_COLORS, type Particle } from "./fruitVisuals";
import { getFxPreset } from "./fxPreset";

// Number of pre-allocated Graphics objects in the slash pool.
// 4 is more than enough: a single slice lasts 0.2 s and you can't physically
// perform more than ~8 slices/second, so 4 covers overlap comfortably.
const SLASH_POOL_SIZE = 6;

interface Callbacks {
  muted: boolean;
  onPlaySlice?: () => void;
  onPlayBomb?: () => void;
}

interface Props {
  playLayerRef: React.RefObject<Container | null>;
  texturesRef: React.MutableRefObject<Record<string, Texture>>;
  sizeRef: React.MutableRefObject<{ w: number; h: number }>;
  addParticle: (particle: Particle) => void;
  spawnPooledParticle: (params: {
    x: number;
    y: number;
    tint: number;
    radius: number;
    vx: number;
    vy: number;
    life: number;
  }) => boolean;
  triggerBombFeedback: (screen: { x: number; y: number }) => void;
  triggerPointFeedback: (input: { x: number; y: number; text: string; color: string; variant?: "points" | "combo" | "critical" }) => void;
  callbacksRef: React.MutableRefObject<Callbacks>;
}

// ─── Internal slash pool entry ────────────────────────────────────────────────

interface SlashSlot {
  g: Graphics;
  inUse: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSliceEffects({
  playLayerRef,
  texturesRef,
  sizeRef,
  addParticle,
  spawnPooledParticle,
  triggerBombFeedback,
  triggerPointFeedback,
  callbacksRef,
}: Props) {
  // Small pool of reusable Graphics for slash effects.
  // Lazily initialised on first use (layer must exist by then).
  const slashPoolRef = useRef<SlashSlot[]>([]);
  // Round-robin cursor to pick the next slot.
  const slashCursorRef = useRef(0);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function destroyDisplay(display: Container) {
    try {
      if (display.parent) display.parent.removeChild(display);
    } catch { /* ignore */ }
    try {
      if (!display.destroyed) {
        display.destroy({ children: true, texture: false, textureSource: false });
      }
    } catch { /* ignore */ }
  }

  function getTexture(key: string): Texture | null {
    return texturesRef.current[key] ?? null;
  }

  function renderScale(): number {
    return getWorldRenderTransform(sizeRef.current.w, sizeRef.current.h).scaleX;
  }

  function verticalRenderScale(): number {
    return getWorldRenderTransform(sizeRef.current.w, sizeRef.current.h).scaleY;
  }

  function worldToScreen(x: number, y: number) {
    return projectWorldToScreen(x, y, sizeRef.current.w, sizeRef.current.h);
  }

  /** Hand an already-built Container to the legacy particle system for lifetime management. */
  function handoffDisplay(
    display: Container,
    particle: Omit<Particle, "g">,
    layer: Container,
  ) {
    try {
      if (display.destroyed) { destroyDisplay(display); return false; }
      layer.addChild(display);
      addParticle({ g: display, ...particle });
      if (display.destroyed || display.parent !== layer) { destroyDisplay(display); return false; }
      return true;
    } catch {
      destroyDisplay(display);
      return false;
    }
  }

  // ── Slash Graphics pool ────────────────────────────────────────────────────

  /**
   * Lazily build the slash pool once the play layer is available.
   * Graphics in the pool are added to the play layer once and stay there;
   * they are just cleared + redrawn each reuse.
   *
   * Safety: also rebuilds if any slot was destroyed (e.g. after a full
   * Pixi stage teardown between replays).
   */
  function ensureSlashPool(layer: Container) {
    const pool = slashPoolRef.current;
    // Rebuild if wrong size OR if any slot was destroyed (replay / stage teardown).
    const needsRebuild = pool.length !== SLASH_POOL_SIZE || pool.some((s) => s.g.destroyed);
    if (!needsRebuild) return;

    // Cleanup any surviving Graphics before rebuild.
    for (const slot of pool) {
      try { if (!slot.g.destroyed) slot.g.destroy(); } catch { /* ignore */ }
    }
    slashPoolRef.current = [];

    for (let i = 0; i < SLASH_POOL_SIZE; i++) {
      const g = new Graphics();
      g.visible = false;
      g.alpha = 0;
      layer.addChild(g);
      slashPoolRef.current.push({ g, inUse: false });
    }
    slashCursorRef.current = 0;
  }

  /**
   * Grab a slash slot using round-robin, evicting the oldest one if all are in
   * use. The slot's Graphics is cleared, redrawn, and handed to the legacy
   * particle system for fade management.
   */
  function acquireSlashSlot(layer: Container): SlashSlot | null {
    ensureSlashPool(layer);
    const pool = slashPoolRef.current;
    if (pool.length === 0) return null;

    // Pick next slot (round-robin — if in use it just gets overwritten, which
    // is fine: it means an older slash is being recycled early).
    const slot = pool[slashCursorRef.current % SLASH_POOL_SIZE];
    slashCursorRef.current = (slashCursorRef.current + 1) % SLASH_POOL_SIZE;
    slot.inUse = true;
    return slot;
  }

  // ── Splat (pool-based) ─────────────────────────────────────────────────────

  function spawnSplat(x: number, y: number, color: number, count: number, size: number) {
    if (!playLayerRef.current) return;
    if (!texturesRef.current["circle"]) return;

    for (let index = 0; index < count; index += 1) {
      const radius = size * (0.4 + Math.random() * 0.9);
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 220;
      const ttl = 0.6 + Math.random() * 0.3;

      spawnPooledParticle({
        x,
        y,
        tint: color,
        radius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: ttl,
      });
      // If pool is exhausted the call is silently dropped (no crash).
    }
  }

  // ── Main slice effect ──────────────────────────────────────────────────────

  function showSliceEffect(result: SliceResult, direction: { dx: number; dy: number }) {
    const layer = playLayerRef.current;
    if (!layer || !result?.fruit) return;

    const screen = worldToScreen(result.fruit.x, result.fruit.y);
    const preset = getFxPreset(sizeRef.current.w);

    if (result.fruit.kind === "bomb") {
      spawnSplat(screen.x, screen.y, 0xff5a2a, preset.bombFireParticles, 8);
      spawnSplat(screen.x, screen.y, 0xffe66a, preset.bombSparkParticles, 6);
      spawnSplat(screen.x, screen.y, 0x1f1f1f, preset.bombSmokeParticles, 10);
      triggerBombFeedback(screen);
      if (!callbacksRef.current.muted) callbacksRef.current.onPlayBomb?.();
      return;
    }

    const angle = Math.atan2(direction.dy, direction.dx);
    const perpendicular = angle + Math.PI / 2;
    const splitSpeed = 220;
    const scale = renderScale();

    // ── Slash effect (reuse Graphics from pool) ──
    const slashSlot = acquireSlashSlot(layer);
    if (slashSlot) {
      const slash = slashSlot.g;
      // Ensure slash is in this layer (it may have been reparented on a replay).
      if (slash.parent !== layer) {
        try { if (slash.parent) slash.parent.removeChild(slash); } catch { /* ignore */ }
        layer.addChild(slash);
      }
      const slashLength = Math.max(120, result.fruit.radius * scale * 4.2);
      slash.clear();
      slash.moveTo(-slashLength / 2, 0).lineTo(slashLength / 2, 0)
        .stroke({ color: 0xffffff, width: 16, alpha: 0.9, cap: "round" });
      slash.moveTo(-slashLength / 2, 0).lineTo(slashLength / 2, 0)
        .stroke({ color: 0xe87432, width: 7, alpha: 1, cap: "round" });
      slash.position.set(screen.x, screen.y);
      slash.rotation = angle;
      slash.visible = true;
      slash.alpha = 1;

      // Hand to legacy particle system for alpha fade (life 0.2 s).
      // pooled:true tells the legacy expire path to HIDE+CLEAR this Graphics
      // instead of destroying it — the slash pool still owns it.
      addParticle({
        g: slash,
        vx: 0, vy: 0, rot: angle, vr: 0,
        life: 0.2, ttl: 0.2, rotates: false,
        pooled: true,
      });
    }

    // ── Fruit halves (new Sprite per slice — low frequency, safe) ──
    (["left", "right"] as const).forEach((side, index) => {
      const halfTexture = getTexture(`${result.fruit.kind}_${side}`);
      if (!halfTexture) return;

      const g = new Sprite(halfTexture);
      g.anchor.set(0.5);
      g.position.set(screen.x, screen.y);
      g.rotation = result.fruit.rotation;
      g.scale.set(scale);
      const vr = (Math.random() - 0.5) * 10;

      handoffDisplay(g, {
        vx: result.fruit.vx * renderScale() + Math.cos(perpendicular) * splitSpeed * (index === 0 ? -1 : 1),
        vy: result.fruit.vy * verticalRenderScale() + Math.sin(perpendicular) * splitSpeed * (index === 0 ? -1 : 1) - 80,
        rot: result.fruit.rotation,
        vr,
        life: 1,
        ttl: 1,
        rotates: true,
      }, layer);
    });

    // ── Splat particles (pool-based) ──
    spawnSplat(screen.x, screen.y, FRUIT_COLORS[result.fruit.kind].flesh, preset.sliceFleshParticles, 5);
    spawnSplat(screen.x, screen.y, FRUIT_COLORS[result.fruit.kind].body, preset.sliceBodyParticles, 3);

    // ── Point feedback ──
    triggerPointFeedback({
      x: screen.x,
      y: screen.y,
      text: result.fruit.kind === "peanut" ? "+" + result.points + " SIÊU HIẾM!" : "+" + result.points,
      color: result.fruit.kind === "peanut" ? "var(--mascot-yellow)" : "var(--primary)",
      variant: "points",
    });

    if (result.combo >= 2) {
      const critical = result.combo >= 5;
      triggerPointFeedback({
        x: screen.x + 74,
        y: screen.y - 18,
        text: (critical ? "CRITICAL" : "COMBO") + " x" + result.combo,
        color: critical ? "var(--destructive)" : "var(--orange-cta)",
        variant: critical ? "critical" : "combo",
      });
    }

    if (!callbacksRef.current.muted) callbacksRef.current.onPlaySlice?.();
  }

  // ── Cleanup helper (call on unmount/replay) ───────────────────────────────

  function destroySlashPool() {
    for (const slot of slashPoolRef.current) {
      try {
        if (!slot.g.destroyed) slot.g.destroy({ children: false, texture: false, textureSource: false });
      } catch { /* ignore */ }
    }
    slashPoolRef.current = [];
  }

  return { showSliceEffect, destroySlashPool };
}
