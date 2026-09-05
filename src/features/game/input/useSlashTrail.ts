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

    // Prune in place. filter() allocated a new array on every Pixi frame while
    // the user was slashing, even though the trail has a tiny fixed upper bound.
    const points = trailPointsRef.current;
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < points.length; readIndex += 1) {
      if (now - points[readIndex].t < maxAgeMs) {
        points[writeIndex] = points[readIndex];
        writeIndex += 1;
      }
    }
    points.length = writeIndex;

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

    const totalSegments = points.length - 1;
    const numSections = totalSegments <= 2 ? 1 : totalSegments <= 6 ? 2 : 3;

    // Partition points into continuous connected sections sharing boundaries
    const sections: Array<{
      startIndex: number;
      endIndex: number;
      alpha: number;
    }> = [];

    for (let s = 0; s < numSections; s += 1) {
      const startIndex = Math.floor((s * totalSegments) / numSections);
      const endIndex = Math.floor(((s + 1) * totalSegments) / numSections);
      if (endIndex <= startIndex) continue;

      const midPoint = points[Math.floor((startIndex + endIndex) / 2)];
      const alpha = Math.max(0.05, Math.min(1, 1 - (now - midPoint.t) / maxAgeMs));
      sections.push({ startIndex, endIndex, alpha });
    }

    // Pass 1: Outer glow (white) for all sections
    for (let s = 0; s < sections.length; s += 1) {
      const section = sections[s];
      const start = points[section.startIndex];
      trailGraphics.moveTo(start.x, start.y);
      for (let i = section.startIndex + 1; i <= section.endIndex; i += 1) {
        trailGraphics.lineTo(points[i].x, points[i].y);
      }
      trailGraphics.stroke({
        color: 0xffffff,
        width: 18 * section.alpha + 5,
        alpha: section.alpha * 0.95,
        cap: "round",
        join: "round",
      });
    }

    // Pass 2: Inner blade core (orange) on top for all sections
    for (let s = 0; s < sections.length; s += 1) {
      const section = sections[s];
      const start = points[section.startIndex];
      trailGraphics.moveTo(start.x, start.y);
      for (let i = section.startIndex + 1; i <= section.endIndex; i += 1) {
        trailGraphics.lineTo(points[i].x, points[i].y);
      }
      trailGraphics.stroke({
        color: 0xe87432,
        width: 7 * section.alpha + 2,
        alpha: section.alpha,
        cap: "round",
        join: "round",
      });
    }
  }, [trailGraphicsRef, maxAgeMs]);

  return {
    trailPointsRef,
    addTrailPoint,
    clearTrail,
    drawTrail,
  };
}
