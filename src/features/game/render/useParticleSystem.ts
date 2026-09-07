/**
 * useParticleSystem — Object-pooled particle management.
 *
 * Performance notes (Phase 2):
 * - Pre-allocates a fixed pool of Container/Sprite slots on init.
 * - Spawn = take an inactive slot from pool + reset all fields.
 * - Expire = mark slot inactive, hide sprite; no destroy() per frame.
 * - Destroy only runs on unmount (cleanup sweep of the whole pool).
 * - If pool is exhausted the spawn is silently dropped (no crash, no
 *   allocation beyond cap).
 *
 * Pool is initialised externally via initPool() after Pixi textures are
 * ready. This owner manages only splats; slice effects own halves and hit flashes.
 */
import { useEffect, useRef } from "react";
import type { Container } from "pixi.js";
import { Sprite } from "pixi.js";
import { type Particle } from "./fruitVisuals";

// ─── Pool entry ──────────────────────────────────────────────────────────────

export interface PoolParticle extends Particle {
  /** True while this slot is being used for a live particle. */
  active: boolean;
}

export function useParticleSystem() {
  /**
   * poolRef holds all pre-allocated pool entries.
   * Inactive entries only incur a boolean check during update.
   */
  const poolRef = useRef<PoolParticle[]>([]);
  const nextSlotRef = useRef(0);
  // ── Pool initialisation ───────────────────────────────────────────────────

  /**
   * Build or rebuild the pool with `size` pre-allocated Sprite slots using
   * the given `circleTexture`.  Must be called after textures are ready and
   * after the play layer exists.
   *
   * @param layer       Pixi Container to add sprites to (they start hidden).
   * @param circleTexture  Shared white-circle texture for splat particles.
   * @param size        Number of slots to pre-allocate (= maxParticles preset).
   */
  function initPool(layer: Container, circleTexture: import("pixi.js").Texture, size: number) {
    // Destroy any previous pool (e.g. on replay / texture reload).
    destroyPool();

    const newPool: PoolParticle[] = [];
    for (let i = 0; i < size; i++) {
      const sprite = new Sprite(circleTexture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      sprite.alpha = 0;
      sprite.label = `Particle:${i}`;
      layer.addChild(sprite);

      newPool.push({
        g: sprite,
        vx: 0, vy: 0, rot: 0, vr: 0,
        life: 0, ttl: 1,
        rotates: false,
        active: false,
      });
    }
    poolRef.current = newPool;
  }

  // ── Pool-based spawn ──────────────────────────────────────────────────────

  /**
   * Take an inactive pool slot and configure it for a new splat particle.
   * Returns true if a slot was available, false if the pool was exhausted.
   */
  function spawnPooledParticle(params: {
    x: number;
    y: number;
    tint: number;
    radius: number;
    vx: number;
    vy: number;
    life: number;
  }): boolean {
    const pool = poolRef.current;
    if (pool.length === 0) return false; // pool not yet initialised

    // Continue after the last allocation; inspect at most one complete pool.
    for (let offset = 0; offset < pool.length; offset++) {
      const i = (nextSlotRef.current + offset) % pool.length;
      const slot = pool[i];
      if (slot.active) continue;

      // Reset sprite — all fields must be set to avoid stale state from prior use.
      const sprite = slot.g as Sprite;
      // Note: texture is always circleTexture (set at initPool) — no reassignment needed.
      sprite.tint = params.tint;
      sprite.width = params.radius * 2;
      sprite.height = params.radius * 2;
      sprite.x = params.x;
      sprite.y = params.y;
      sprite.rotation = 0;
      sprite.alpha = 1;
      sprite.visible = true;

      // Reset physics.
      slot.vx = params.vx;
      slot.vy = params.vy;
      slot.rot = 0;
      slot.vr = 0;
      slot.life = params.life;
      slot.ttl = params.life;
      slot.rotates = false;
      slot.active = true;
      nextSlotRef.current = (i + 1) % pool.length;

      return true;
    }

    // Pool exhausted — silently skip this particle.
    return false;
  }

  function destroyPool() {
    for (const slot of poolRef.current) {
      const sprite = slot.g;
      try { if (sprite.parent) sprite.parent.removeChild(sprite); } catch { /* ignore */ }
      try {
        if (!sprite.destroyed) sprite.destroy({ children: false, texture: false, textureSource: false });
      } catch { /* ignore */ }
    }
    poolRef.current = [];
    nextSlotRef.current = 0;
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  function updateParticles(deltaSeconds: number, viewportHeight: number) {
    // ── Pool particles ──
    for (const slot of poolRef.current) {
      if (!slot.active) continue;

      slot.vy += 1000 * 0.5 * deltaSeconds; // splat particles don't rotate
      slot.g.x += slot.vx * deltaSeconds;
      slot.g.y += slot.vy * deltaSeconds;
      slot.life -= deltaSeconds;
      slot.g.alpha = Math.max(0, slot.life / slot.ttl);

      if (slot.life <= 0 || slot.g.y > viewportHeight + 100) {
        // Return slot to pool — no destroy.
        slot.active = false;
        slot.g.visible = false;
        slot.g.alpha = 0;
      }
    }
  }

  // ── Batch clear ───────────────────────────────────────────────────────────

  function clearParticles() {
    nextSlotRef.current = 0;
    // Pool: just deactivate (don't destroy — pool stays alive for reuse).
    for (const slot of poolRef.current) {
      if (slot.active) {
        slot.active = false;
        slot.g.visible = false;
        slot.g.alpha = 0;
      }
    }
  }

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Full cleanup: destroy splat pool sprites.
      destroyPool();
    };
  }, []);

  return { updateParticles, clearParticles, initPool, spawnPooledParticle };
}
