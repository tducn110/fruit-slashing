# Performance Optimization Notes — Fruit Slice / Bộ Lạc Đậu Phộng

## Overview

This document records what each performance phase did, the current limits, and
how to verify regressions.

---

## Phase 1 — Environment & FX Presets

| Change | File |
|--------|------|
| Added `FxPreset` interface + desktop/mobile presets | `src/features/game/render/fxPreset.ts` |
| Applied `resolutionCap` and `antialias` to Pixi `Application.init` | `src/features/game/render/usePixiApp.ts` |
| Applied particle counts from preset to splat spawns | `src/features/game/render/useSliceEffects.ts` |
| Applied `trailPoints` cap to `useSlashTrail` via `getMaxPoints` | `src/components/game/FruitGame.tsx` |

### Preset values

|  | Desktop (w > 640) | Mobile (w ≤ 640) |
|--|-------------------|------------------|
| `resolutionCap` | 1.5 | 1.0 |
| `antialias` | true | false |
| `sliceFleshParticles` | 16 | 10 |
| `sliceBodyParticles` | 8 | 5 |
| `bombFireParticles` | 18 | 14 |
| `bombSparkParticles` | 12 | 9 |
| `bombSmokeParticles` | 8 | 6 |
| `maxParticles` | 160 | 80 |
| `trailPoints` | 18 | 12 |

---

## Phase 2 — Hot-Path Optimization

### Phase 2.1 — Particle Object Pool (`useParticleSystem.ts`)

**Problem:** Every splat particle called `new Sprite(circleTexture)`, and every
expired particle called `sprite.destroy()`. On a fast combo this could allocate
and GC 30–60 Sprite objects per second.

**Fix:**
- `initPool(layer, circleTexture, size)` — pre-allocates `size` Sprite objects
  once after textures are ready, adds them to the play layer, hides them.
- `spawnPooledParticle(params)` — finds the first inactive pool slot, resets all
  fields (position, tint, size, velocity, life), marks `active = true`. Returns
  `false` (silently) if the pool is exhausted.
- On expire: `active = false`, `visible = false`, `alpha = 0`. No `destroy()`.
- On unmount: full `destroy()` sweep of the pool.
- `clearParticles()` deactivates all pool slots without destroying (pool survives
  across replays).

**Acceptance:**
- No `new Sprite()` or `destroy()` during normal gameplay splat spawning.
- Splat budget is capped at `maxParticles` (desktop 160, mobile 80).

### Phase 2.2 — Fruit Halves (not pooled — intentional)

**Decision:** Fruit halves use `new Sprite(halfTexture)` per slice (2 per slice).

**Reason:** Each half uses a texture keyed by `${kind}_left` / `${kind}_right`.
Pooling would require either:
  1. One pool per (kind × side) — 12 pools × ~6 slots = 72 sprites just for halves; marginal benefit.
  2. A unified pool that resets `.texture` — risky: texture assignment triggers
     GPU upload, and the pool size per-texture is small enough that wrong-texture
     bugs are likely during fast combos.

**Current cost:** Max ~2 sprites created/destroyed per slice. At 8 slices/second
that is 16 allocs/s — acceptable given their short lifetime (1 s). They go
through the `legacyRef` path in `useParticleSystem`.

**Future:** If profiling shows fruit-half GC pressure, create per-kind pools.

### Phase 2.3 — Slash Graphics Pool (`useSliceEffects.ts`)

**Problem:** Each `showSliceEffect` call created a `new Graphics()`, drew into it,
handed it to the particle system, and eventually destroyed it. At 8 slices/s this
was 8 Graphics allocations/s.

**Fix:** `slashPoolRef` — 6 pre-allocated `Graphics` objects added to the play
layer at first use. A round-robin cursor picks the next slot, clears and redraws
it. The Graphics object is handed to the `legacyRef` path for alpha fade.

**Pool size:** `SLASH_POOL_SIZE = 6`. A slash lasts 0.2 s; physically achievable
max is ~8 slices/s → at most 1–2 concurrent slashes. 6 slots gives 3× headroom.

**Acceptance:**
- No `new Graphics()` after first slice.
- Slash still visible, fades correctly.
- Old slash not visible at wrong position (cleared before redraw).

### Phase 2.4 — Trail Redraw Guard (`useSlashTrail.ts`)

**Problem:** `drawTrail()` is called every ticker frame (60 fps). It always called
`Graphics.clear()` + re-stroked all segments, even when the cursor was idle.

**Fix:** `dirtyRef` flag.
- Set `dirty = true` when a point is added.
- Set `dirty = true` when stale points are pruned by age.
- `drawTrail()` skips entirely if `dirty = false`.
- `clearTrail()` calls `Graphics.clear()` directly and sets `dirty = false`.

**Result:** Zero Pixi draw calls when cursor is stationary between slices.

### Phase 2.5 — Feedback Text Batching (`useGameFeedback.ts`)

**Problem:** `triggerPointFeedback()` called `setPointTexts()` immediately.
A combo slice triggers 2 calls synchronously (points + combo label), causing
2 React re-renders per frame.

**Fix:** `pendingPointTextsRef` queue + `queueMicrotask` flush.
- Calls accumulate in `pendingPointTextsRef`.
- A single `queueMicrotask(flush)` is scheduled the first time (guarded by
  `flushScheduledRef` to avoid duplicate microtasks).
- Flush: one `setPointTexts()` call with all pending entries.

**Result:** One React state update per *synchronous burst* (e.g. points + combo from one slice
produce one `setState`). Note: `queueMicrotask` batches calls in the same JS turn, not
necessarily all calls within the same animation frame. If calls arrive across different async
turns they may still produce separate flushes — but in practice, combo + points calls are
always synchronous, so the batching works as intended.

**Note:** Bomb feedback is not batched (fires at most once per bomb, low
frequency, simpler code).

---

## Phase 2 Verification (Bug-Fix Round)

After the initial Phase 2 implementation, an audit identified two critical bugs
and one dead-code issue. All were fixed before shipping.

### Bug 1 — Slash pool Graphics destroyed by legacy expire path (Critical)

**Root cause:** `useSliceEffects` handed slash Graphics to `addParticle()` for
alpha-fade management. When the 0.2 s lifetime elapsed, `destroyLegacyParticle()`
in `useParticleSystem` called `display.destroy()` — permanently destroying the
pooled Graphics object. On the next slice, the pool had 6 destroyed slots and
no valid Graphics to draw into. Slash appeared blank.

**Fix:**
- Added `pooled?: boolean` flag to the `Particle` interface in `fruitVisuals.ts`.
- `destroyLegacyParticle()` checks `particle.pooled`: if true, hides + clears
  the Graphics instead of destroying it.
- Slash `addParticle()` call now passes `pooled: true`.

### Bug 2 — Slash pool not rebuilt after `clearParticles()` on replay (Critical)

**Root cause:** `clearParticles()` called `destroyLegacyParticle()` on all
`legacyRef` entries including pooled slash Graphics. On the next replay,
`ensureSlashPool()` checked only `pool.length === SLASH_POOL_SIZE` — which was
still 6 — so it returned early and left the destroyed Graphics in place.

**Fix:**
- `ensureSlashPool()` now also checks `pool.some((s) => s.g.destroyed)` and
  rebuilds if any slot is destroyed.
- `destroyLegacyParticle` with `pooled: true` only hides/clears, so the Graphics
  survive `clearParticles()` — this is now the primary guard.

### Bug 3 — No-op texture reassignment in `spawnPooledParticle` (Minor)

`sprite.texture = (sprite.texture)` was a no-op comment placeholder that added
confusion. Removed; replaced with a comment explaining the texture is always
`circleTexture` set at `initPool` time.

### Inaccurate claim in docs and comments

"One React render per animation frame" was inaccurate. `queueMicrotask` batches
calls in the same JS turn, not per-frame. Fixed to "one React state update per
synchronous burst".

- Gameplay rules (scoring, hitbox, lives, timer, combo logic).
- Scoring values.
- Visual effects (2 fruit halves, slash, splat, bomb flash/shake, point text,
  combo text).
- Theme and CSS.
- Audio hooks.

---

## How to Test FPS

### Browser DevTools

1. Open Chrome DevTools → Performance tab.
2. Start recording, play game, slice aggressively for 10 s.
3. Inspect the "Frames" row — look for frames > 16.7 ms (drops below 60 fps).
4. Check "JS" bar — particle updates / React renders should be short.

### Stats.js (optional, no npm package required)

Add to `index.html` temporarily:
```html
<script src="https://cdn.jsdelivr.net/npm/stats.js/build/stats.min.js"></script>
<script>
  const stats = new Stats(); stats.showPanel(0);
  document.body.appendChild(stats.dom);
  function loop() { stats.begin(); stats.end(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
</script>
```

### PixiJS DevTools (Chrome extension)

Install the [PixiJS DevTools](https://chrome.google.com/webstore/detail/pixijs-devtools/) extension. It shows:
- Draw call count per frame (should be low: background + fruits + particles + trail).
- Object counts (pool sprites should not grow after init).

---

## How to Detect Regressions

| Regression | Signal |
|------------|--------|
| Particle pool exhausted silently | Splat particles visible on 1st combo but missing on 10th |
| Wrong pool slot tint/size | Particles appear wrong colour after combo |
| Slash pool stale | Old slash line appears at wrong position |
| Trail redraws every frame | `console.count('drawTrail')` increments even when idle |
| Feedback batching broken | 2+ React renders per combo in React DevTools profiler |
| Memory leak (no pool destroy) | Heap snapshot grows monotonically across replays |

### Quick regression smoke test

```bash
npm run typecheck
npm test
npm run build
```

All three must pass with no new errors.

---

## Follow-up Recommendations

- **Fruit-half pooling** (per-kind, low risk): If profiling ever shows halves
  in GC, create 6 slots per (kind × side). 12 fruit types × 2 sides × 6 = 144
  sprites; still much less than continuous alloc.
- **ParticleContainer migration**: Pixi's `ParticleContainer` is faster than
  a regular `Container` for uniform sprites (same texture, tint-only variance).
  Splat particles are a good candidate once the texture unification is clean.
- **PixiJS Text for feedback**: Moving point/combo text from React DOM to
  `BitmapText` would eliminate all React renders during gameplay. Risk: requires
  font atlas setup and CSS parity. Worth considering for a Phase 3.
- **Trail as Mesh/Rope**: A `MeshRope` reusing a thin texture would allow the
  trail to be drawn as a single draw call (currently O(n) strokes). Low visual
  risk, medium implementation effort.
