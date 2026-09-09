/** Slice effects own their pooled displays and lifetimes. Splats have a separate owner. */
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { type Container, Graphics, Sprite, type Texture } from "pixi.js";
import { getWorldRenderTransform, worldToScreen as projectWorldToScreen, type SliceResult } from "../../../game/core";
import { FRUIT_COLORS, getFruitArtworkScale, type Particle } from "./fruitVisuals";
import { getFxPreset, type FxPreset } from "./fxPreset";

// A burst can exceed this capacity; round-robin reuse resets the one owned lifetime.
const SLASH_POOL_SIZE = 6;
const HALF_POOL_SIZE = 24;

interface Callbacks {
  muted: boolean;
}

interface Props {
  playLayerRef: React.RefObject<Container | null>;
  texturesRef: React.MutableRefObject<Record<string, Texture>>;
  sizeRef: React.MutableRefObject<{ w: number; h: number }>;
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
  getPreset?: () => FxPreset;
}

// ─── Internal slash pool entry ────────────────────────────────────────────────

interface SlashSlot {
  g: Graphics;
  life: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSliceEffects({
  playLayerRef,
  texturesRef,
  sizeRef,
  spawnPooledParticle,
  triggerBombFeedback,
  triggerPointFeedback,
  getPreset,
}: Props) {
  const { t } = useTranslation();
  // Small pool of reusable Graphics for slash effects.
  // Prewarmed with the half pool after the play layer and textures are ready.
  const slashPoolRef = useRef<SlashSlot[]>([]);
  // Round-robin cursor to pick the next slot.
  const slashCursorRef = useRef(0);
  // Each half slot holds both display and lifetime; no external tracker can expire it.
  const halfPoolRef = useRef<Particle[]>([]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getTexture(key: string): Texture | null {
    return texturesRef.current[key] ?? null;
  }

  function initHalfPool(layer: Container) {
    const pool = halfPoolRef.current;
    if (pool.length === HALF_POOL_SIZE && pool.every((slot) => !slot.g.destroyed)) {
      ensureSlashPool(layer);
      return;
    }

    destroyHalfPool();
    for (let index = 0; index < HALF_POOL_SIZE; index += 1) {
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      sprite.visible = false;
      sprite.alpha = 0;
      sprite.label = `FruitHalf:slot:${index}:idle`;
      layer.addChild(sprite);
      halfPoolRef.current.push({ g: sprite, vx: 0, vy: 0, rot: 0, vr: 0, life: 0, ttl: 1, rotates: true });
    }
    ensureSlashPool(layer);
  }

  function acquireHalf(texture: Texture, label?: string): Particle | undefined {
    const slot = halfPoolRef.current.find((candidate) => candidate.life <= 0);
    if (!slot) return undefined;
    const sprite = slot.g as Sprite;
    sprite.texture = texture;
    sprite.visible = true;
    sprite.alpha = 1;
    sprite.label = label ?? "FruitHalf:active";
    return slot;
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
      // Geometry is built once. A hit changes only the display transform.
      g.moveTo(-60, 0).lineTo(60, 0).stroke({ color: 0xffffff, width: 16, alpha: 0.9, cap: "round" });
      g.moveTo(-60, 0).lineTo(60, 0).stroke({ color: 0xe87432, width: 7, alpha: 1, cap: "round" });
      g.label = `SlashEffect:${i}`;
      g.visible = false;
      g.alpha = 0;
      layer.addChild(g);
      slashPoolRef.current.push({ g, life: 0 });
    }
    slashCursorRef.current = 0;
  }

  function acquireSlashSlot(layer: Container): SlashSlot | null {
    ensureSlashPool(layer);
    const pool = slashPoolRef.current;
    if (pool.length === 0) return null;

    // Pick next slot (round-robin — if in use it just gets overwritten, which
    // is fine: it means an older slash is being recycled early).
    const slot = pool[slashCursorRef.current % SLASH_POOL_SIZE];
    slashCursorRef.current = (slashCursorRef.current + 1) % SLASH_POOL_SIZE;
    slot.life = 0.2;
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
    const preset = getPreset?.() ?? getFxPreset(sizeRef.current.w);

    if (result.fruit.kind === "bomb") {
      spawnSplat(screen.x, screen.y, 0xff5a2a, preset.bombFireParticles, 8);
      spawnSplat(screen.x, screen.y, 0xffe66a, preset.bombSparkParticles, 6);
      spawnSplat(screen.x, screen.y, 0x1f1f1f, preset.bombSmokeParticles, 10);
      triggerBombFeedback(screen);
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
      slash.scale.set(slashLength / 120, 1);
      slash.position.set(screen.x, screen.y);
      slash.rotation = angle;
      slash.visible = true;
      slash.alpha = 1;
    }

    // ── Fruit halves (pooled; no Sprite allocation per slice) ──
    (["left", "right"] as const).forEach((side, index) => {
      const halfTexture = getTexture(`${result.fruit.kind}_${side}`);
      if (!halfTexture) return;

      const slot = acquireHalf(halfTexture, `FruitHalf:${result.fruit.kind}:${side}`);
      if (!slot) return;
      const g = slot.g;
      g.position.set(screen.x, screen.y);
      g.rotation = result.fruit.rotation;
      g.scale.set(getFruitArtworkScale(result.fruit.kind, sizeRef.current.w, sizeRef.current.h));
      const vr = (Math.random() - 0.5) * 10;

      slot.vx = result.fruit.vx * scale + Math.cos(perpendicular) * splitSpeed * (index === 0 ? -1 : 1);
      slot.vy = result.fruit.vy * verticalRenderScale() + Math.sin(perpendicular) * splitSpeed * (index === 0 ? -1 : 1) - 80;
      slot.rot = result.fruit.rotation;
      slot.vr = vr;
      slot.life = 1;
      slot.ttl = 1;
    });

    // ── Splat particles (pool-based) ──
    spawnSplat(screen.x, screen.y, FRUIT_COLORS[result.fruit.kind].flesh, preset.sliceFleshParticles, 5);
    spawnSplat(screen.x, screen.y, FRUIT_COLORS[result.fruit.kind].body, preset.sliceBodyParticles, 3);

    // ── Point feedback ──
    triggerPointFeedback({
      x: screen.x,
      y: screen.y,
      text: result.fruit.kind === "peanut" ? `+${result.points} ${t('game.super_rare')}` : `+${result.points}`,
      color: result.fruit.kind === "peanut" ? "var(--mascot-yellow)" : "var(--primary)",
      variant: "points",
    });

    if (result.combo >= 2) {
      const critical = result.combo >= 5;
      triggerPointFeedback({
        x: screen.x + 74,
        y: screen.y - 18,
        text: `${critical ? t('game.critical') : t('game.combo')} x${result.combo}`,
        color: critical ? "var(--destructive)" : "var(--orange-cta)",
        variant: critical ? "critical" : "combo",
      });
    }
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

  function destroyHalfPool() {
    for (const slot of halfPoolRef.current) {
      const sprite = slot.g;
      try {
        if (sprite.parent) sprite.parent.removeChild(sprite);
      } catch { /* ignore */ }
      try {
        if (!sprite.destroyed) sprite.destroy({ children: false, texture: false, textureSource: false });
      } catch { /* ignore */ }
    }
    halfPoolRef.current = [];
  }

  function clearSliceEffects() {
    slashCursorRef.current = 0;
    for (const slot of slashPoolRef.current) { slot.life = 0; slot.g.visible = false; slot.g.alpha = 0; }
    for (const slot of halfPoolRef.current) { slot.life = 0; slot.g.visible = false; slot.g.alpha = 0; }
  }

  function updateSliceEffects(deltaSeconds: number, viewportHeight: number) {
    for (const slot of slashPoolRef.current) {
      if (slot.life <= 0) continue;
      slot.life = Math.max(0, slot.life - deltaSeconds);
      slot.g.alpha = slot.life / 0.2;
      slot.g.visible = slot.life > 0;
    }
    for (const slot of halfPoolRef.current) {
      if (slot.life <= 0) continue;
      slot.life = Math.max(0, slot.life - deltaSeconds);
      slot.vy += 1000 * deltaSeconds;
      slot.g.x += slot.vx * deltaSeconds;
      slot.g.y += slot.vy * deltaSeconds;
      slot.rot += slot.vr * deltaSeconds;
      slot.g.rotation = slot.rot;
      if (slot.g.y > viewportHeight + 100) slot.life = 0;
      slot.g.alpha = slot.life / slot.ttl;
      slot.g.visible = slot.life > 0;
    }
  }

  return { showSliceEffect, initHalfPool, destroySlashPool, destroyHalfPool, clearSliceEffects, updateSliceEffects };
}
