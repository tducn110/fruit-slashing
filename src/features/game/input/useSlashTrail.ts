import { useCallback, useRef, type RefObject } from "react";
import type { Graphics } from "pixi.js";

export interface TrailPoint { x: number; y: number; t: number; }
interface UseSlashTrailOptions {
  trailGraphicsRef: RefObject<Graphics | null>;
  maxAgeMs?: number;
  getMaxPoints?: () => number;
}
const defaultMaxPoints = () => 18;

export function useSlashTrail({ trailGraphicsRef, maxAgeMs = 320, getMaxPoints = defaultMaxPoints }: UseSlashTrailOptions) {
  const trailPointsRef = useRef<TrailPoint[]>([]);

  const initTrail = useCallback(() => {
    // Kept as no-op for caller compatibility
  }, []);

  const addTrailPoint = useCallback((point: TrailPoint) => {
    const points = trailPointsRef.current;
    points.push(point);
    const capacity = Math.max(0, getMaxPoints());
    if (points.length > capacity) points.splice(0, points.length - capacity);
  }, [getMaxPoints]);

  const clearTrail = useCallback(() => {
    trailPointsRef.current.length = 0;
    const g = trailGraphicsRef.current;
    if (g && !g.destroyed) g.clear();
  }, [trailGraphicsRef]);

  const drawTrail = useCallback(() => {
    const g = trailGraphicsRef.current;
    if (!g || g.destroyed) return;
    const now = performance.now();
    const points = trailPointsRef.current;
    let write = 0;
    for (let read = 0; read < points.length; read++) {
      if (now - points[read].t < maxAgeMs) points[write++] = points[read];
    }
    points.length = write;

    g.clear();
    if (points.length < 2) return;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const alpha = Math.max(0, Math.min(1, 1 - (now - p1.t) / maxAgeMs));
      g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({
        color: 0xffffff,
        width: 18 * alpha + 5,
        alpha: alpha * 0.95,
        cap: "round",
        join: "round",
      });
      g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({
        color: 0xe87432,
        width: 7 * alpha + 2,
        alpha,
        cap: "round",
        join: "round",
      });
    }
  }, [trailGraphicsRef, maxAgeMs]);

  return { trailPointsRef, initTrail, addTrailPoint, clearTrail, drawTrail };
}
