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
 * ready.  Until initPool() is called, addParticle() accepts a pre-built
 * Particle (legacy path) so the API stays backward-compatible.
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

// ─── Hook options ────────────────────────────────────────────────────────────

interface UseParticleSystemOptions {
  getMaxParticles?: () => number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useParticleSystem({ getMaxParticles = () => 160 }: UseParticleSystemOptions = {}) {
  /**
   * poolRef holds all pre-allocated pool entries.
   * We keep a separate activeRef list for O(n) iteration during update.
   */
  const poolRef = useRef<PoolParticle[]>([]);
  /**
   * Legacy list: non-pooled particles handed to us via addParticle().
   * This remains so callers that pass pre-built Sprites still work.
   */
  const legacyRef = useRef<Particle[]>([]);

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

    // Find first inactive slot.
    for (let i = 0; i < pool.length; i++) {
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

      return true;
    }

    // Pool exhausted — silently skip this particle.
    return false;
  }

  // ── Legacy addParticle (keeps backward compat) ────────────────────────────

  /**
   * Legacy path: caller has already constructed a Sprite/Graphics and wants
   * the system to manage its lifetime.  Used for fruit halves and slash
   * Graphics which have per-use textures/shapes and cannot share a pool slot.
   */
  function addParticle(particle: Particle) {
    if (particle.g.destroyed) return;
    if (!particle.g.parent) return;

    const maxParticles = getMaxParticles();
    // Drop oldest legacy particle if we're over budget.
    if (legacyRef.current.length >= maxParticles) {
      const oldest = legacyRef.current.shift();
      if (oldest) destroyLegacyParticle(oldest);
    }

    legacyRef.current.push(particle);
  }

  // ── Internal destroy helpers ──────────────────────────────────────────────

  function destroyLegacyParticle(particle: Particle) {
    const display = particle.g;
    if (!display) return;

    // Pooled objects (e.g. slash Graphics) must NOT be destroyed — the pool
    // owns them and will reuse them.  Just hide and clear visual state.
    if (particle.pooled) {
      try {
        display.visible = false;
        display.alpha = 0;
        // Clear Graphics paths so the object is visually blank when reused.
        if ("clear" in display && typeof (display as { clear?: unknown }).clear === "function") {
          (display as unknown as { clear: () => void }).clear();
        }
      } catch { /* ignore */ }
      return;
    }

    try { if (display.parent) display.parent.removeChild(display); } catch { /* ignore race */ }
    try {
      if (!display.destroyed) {
        display.destroy({ children: true, texture: false, textureSource: false });
      }
    } catch { /* ignore */ }
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

    // ── Legacy particles (halves, slash Graphics) ──
    for (let i = legacyRef.current.length - 1; i >= 0; i--) {
      const p = legacyRef.current[i];

      if (p.g.destroyed || !p.g.parent) {
        legacyRef.current.splice(i, 1);
        continue;
      }

      p.vy += 1000 * (p.rotates ? 1 : 0.5) * deltaSeconds;
      p.g.x += p.vx * deltaSeconds;
      p.g.y += p.vy * deltaSeconds;
      if (p.rotates) {
        p.rot += p.vr * deltaSeconds;
        p.g.rotation = p.rot;
      }
      p.life -= deltaSeconds;
      p.g.alpha = Math.max(0, p.life / p.ttl);
      if (p.life <= 0 || p.g.y > viewportHeight + 100) {
        destroyLegacyParticle(p);
        legacyRef.current.splice(i, 1);
      }
    }
  }

  // ── Batch clear ───────────────────────────────────────────────────────────

  function clearParticles() {
    // Pool: just deactivate (don't destroy — pool stays alive for reuse).
    for (const slot of poolRef.current) {
      if (slot.active) {
        slot.active = false;
        slot.g.visible = false;
        slot.g.alpha = 0;
      }
    }

    // Legacy: destroy each one, but respect the pooled flag.
    legacyRef.current.forEach((p) => destroyLegacyParticle(p));
    legacyRef.current = [];
  }

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      // Full cleanup: destroy pool sprites and legacy particles.
      destroyPool();
      legacyRef.current.forEach((p) => destroyLegacyParticle(p));
      legacyRef.current = [];
    };
  }, []);

  return { addParticle, updateParticles, clearParticles, initPool, spawnPooledParticle };
}
