/**
 * useSlashTrail — Manages the pointer-following visual trail.
 *
 * Performance notes (Phase 2.4):
 * - drawTrail() is called every ticker frame from useGameTicker.
 * - Guard: if the trail has been empty for at least one frame, skip the
 *   Graphics.clear() + redraw entirely. A `dirty` flag is set to true
 *   whenever a point is added or the trail is cleared (so the last clear
 *   still runs exactly once after the trail goes empty).
 * - Redraw only when dirty=true (point added or trail just went empty).
 * - maxPoints is read from the preset (desktop=18, mobile=12) via getMaxPoints.
 * - No input/gameplay changes — only the Pixi render path is guarded.
 */
import { useCallback, useRef, type RefObject } from "react";
import type { Graphics } from "pixi.js";

export interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

interface UseSlashTrailOptions {
  trailGraphicsRef: RefObject<Graphics | null>;
  maxAgeMs?: number;
  getMaxPoints?: () => number;
}

export function useSlashTrail({
  trailGraphicsRef,
  maxAgeMs = 320,
  getMaxPoints = () => 18,
}: UseSlashTrailOptions) {
  const trailPointsRef = useRef<TrailPoint[]>([]);
  /**
   * dirty = true means the trail changed since the last drawTrail() call.
   * Initialised false so we skip any draw before the first pointer event.
   */
  const dirtyRef = useRef(false);

  const addTrailPoint = useCallback((point: TrailPoint) => {
    trailPointsRef.current.push(point);
    if (trailPointsRef.current.length > getMaxPoints()) {
      trailPointsRef.current.shift();
    }
    dirtyRef.current = true;
  }, [getMaxPoints]);

  const clearTrail = useCallback(() => {
    trailPointsRef.current = [];
    const trailGraphics = trailGraphicsRef.current;
    if (trailGraphics) {
      trailGraphics.clear();
    }
    // Mark dirty=false: we already cleared, no need to redraw next frame.
    dirtyRef.current = false;
  }, [trailGraphicsRef]);

  const drawTrail = useCallback(() => {
    const trailGraphics = trailGraphicsRef.current;
    if (!trailGraphics) return;

    const now = performance.now();

    // Prune stale points.
    trailPointsRef.current = trailPointsRef.current.filter((point) => now - point.t < maxAgeMs);

    // ── Skip redraw if trail is empty and already cleared ──────────────────
    if (trailPointsRef.current.length === 0) {
      if (!dirtyRef.current) return;
      // Last frame we had points, now we don't. Clear it once.
      trailGraphics.clear();
      dirtyRef.current = false;
      return;
    }

    // The trail has points. We MUST redraw every frame because their alpha
    // is a continuous function of `now` (fading out smoothly).
    dirtyRef.current = true; // Ensure we do one final clear when it empties.

    trailGraphics.clear();

    for (let index = 1; index < trailPointsRef.current.length; index += 1) {
      const from = trailPointsRef.current[index - 1];
      const to = trailPointsRef.current[index];
      const alpha = 1 - (now - to.t) / maxAgeMs;

      trailGraphics.moveTo(from.x, from.y).lineTo(to.x, to.y)
        .stroke({ color: 0xffffff, width: 18 * alpha + 5, alpha: alpha * 0.95, cap: "round" });
      trailGraphics.moveTo(from.x, from.y).lineTo(to.x, to.y)
        .stroke({ color: 0xe87432, width: 7 * alpha + 2, alpha, cap: "round" });
    }
  }, [trailGraphicsRef, maxAgeMs]);

  return {
    trailPointsRef,
    addTrailPoint,
    clearTrail,
    drawTrail,
  };
}
