import { useCallback, useRef, type RefObject } from "react";
import type { Graphics } from "pixi.js";

export interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

export interface UseSlashTrailOptions {
  trailGraphicsRef: RefObject<Graphics | null>;
  maxAgeMs?: number;
}

export function useSlashTrail({
  trailGraphicsRef,
  maxAgeMs = 320,
}: UseSlashTrailOptions) {
  const trailPointsRef = useRef<TrailPoint[]>([]);

  const addTrailPoint = useCallback((point: TrailPoint) => {
    trailPointsRef.current.push(point);
    if (trailPointsRef.current.length > 18) {
      trailPointsRef.current.shift();
    }
  }, []);

  const clearTrail = useCallback(() => {
    trailPointsRef.current = [];
    const trailGraphics = trailGraphicsRef.current;
    if (trailGraphics) {
      trailGraphics.clear();
    }
  }, [trailGraphicsRef]);

  const drawTrail = useCallback(() => {
    const trailGraphics = trailGraphicsRef.current;
    if (!trailGraphics) return;

    trailGraphics.clear();
    const now = performance.now();

    // Prune old points
    trailPointsRef.current = trailPointsRef.current.filter((point) => now - point.t < maxAgeMs);

    for (let index = 1; index < trailPointsRef.current.length; index += 1) {
      const from = trailPointsRef.current[index - 1];
      const to = trailPointsRef.current[index];
      const alpha = 1 - (now - to.t) / 320;

      trailGraphics.moveTo(from.x, from.y).lineTo(to.x, to.y)
        .stroke({ color: 0xffffff, width: 18 * alpha + 5, alpha: alpha * 0.95, cap: "round" });
      trailGraphics.moveTo(from.x, from.y).lineTo(to.x, to.y)
        .stroke({ color: 0xe87432, width: 7 * alpha + 2, alpha, cap: "round" });
    }
  }, [trailGraphicsRef]);

  return {
    trailPointsRef,
    addTrailPoint,
    clearTrail,
    drawTrail,
  };
}
