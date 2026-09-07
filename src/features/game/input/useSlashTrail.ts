/** Reusable immutable trail geometry. Pointer frames only change transforms/alpha. */
import { useCallback, useRef, type RefObject } from "react";
import { Graphics, type Container } from "pixi.js";

export interface TrailPoint { x: number; y: number; t: number }
interface UseSlashTrailOptions {
  trailGraphicsRef: RefObject<Container | null>;
  maxAgeMs?: number;
  getMaxPoints?: () => number;
}
type Segment = { glow: Graphics; core: Graphics; glowCap: Graphics; coreCap: Graphics };
const defaultMaxPoints = () => 18;

export function useSlashTrail({ trailGraphicsRef, maxAgeMs = 320, getMaxPoints = defaultMaxPoints }: UseSlashTrailOptions) {
  const trailPointsRef = useRef<TrailPoint[]>([]);
  const ownerRef = useRef<Container | null>(null);
  const segmentsRef = useRef<Segment[]>([]);

  // Call after the Pixi trail parent is created, before interactive play.
  const initTrail = useCallback(() => {
    const parent = trailGraphicsRef.current;
    if (!parent || parent.destroyed) return;
    if (ownerRef.current !== parent) {
      // Parent owns and destroys its children. A recreated app gets fresh geometry.
      ownerRef.current = parent;
      segmentsRef.current = [];
    }
    const capacity = Math.max(0, getMaxPoints() - 1);
    while (segmentsRef.current.length < capacity) {
      const glow = new Graphics().rect(0, -0.5, 1, 1).fill(0xffffff);
      const core = new Graphics().rect(0, -0.5, 1, 1).fill(0xe87432);
      const glowCap = new Graphics().circle(0, 0, 0.5).fill(0xffffff);
      const coreCap = new Graphics().circle(0, 0, 0.5).fill(0xe87432);
      for (const graphic of [glow, core, glowCap, coreCap]) {
        graphic.visible = false;
        graphic.eventMode = "none";
      }
      // Every white segment stays below every orange segment, including joints.
      parent.addChildAt(glow, 0);
      parent.addChildAt(glowCap, 0);
      parent.addChild(core, coreCap);
      segmentsRef.current.push({ glow, core, glowCap, coreCap });
    }
  }, [trailGraphicsRef, getMaxPoints]);

  const addTrailPoint = useCallback((point: TrailPoint) => {
    const points = trailPointsRef.current;
    points.push(point);
    const capacity = Math.max(0, getMaxPoints());
    if (points.length > capacity) points.splice(0, points.length - capacity);
  }, [getMaxPoints]);

  const clearTrail = useCallback(() => {
    trailPointsRef.current.length = 0;
    for (const segment of segmentsRef.current) {
      segment.glow.visible = segment.core.visible = segment.glowCap.visible = segment.coreCap.visible = false;
    }
  }, []);

  const drawTrail = useCallback(() => {
    const parent = trailGraphicsRef.current;
    if (!parent || parent.destroyed) return;
    const now = performance.now();
    const points = trailPointsRef.current;
    let write = 0;
    for (let read = 0; read < points.length; read++) {
      if (now - points[read].t < maxAgeMs) points[write++] = points[read];
    }
    points.length = write;
    const segments = segmentsRef.current;
    for (let i = 0; i < segments.length; i++) {
      const { glow, core, glowCap, coreCap } = segments[i];
      const visible = i + 1 < points.length;
      glow.visible = core.visible = glowCap.visible = coreCap.visible = visible;
      if (!visible) continue;
      const start = points[i], end = points[i + 1];
      const dx = end.x - start.x, dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      const alpha = Math.max(0, Math.min(1, 1 - (now - start.t) / maxAgeMs));
      const outerWidth = 18 * alpha + 5, innerWidth = 7 * alpha + 2;
      glow.position.set(start.x, start.y);
      core.position.copyFrom(glow.position);
      glow.rotation = core.rotation = Math.atan2(dy, dx);
      glow.scale.set(length, outerWidth);
      core.scale.set(length, innerWidth);
      glowCap.position.set(end.x, end.y);
      coreCap.position.copyFrom(glowCap.position);
      glowCap.scale.set(outerWidth);
      coreCap.scale.set(innerWidth);
      glow.alpha = glowCap.alpha = alpha * 0.95;
      core.alpha = coreCap.alpha = alpha;
    }
  }, [trailGraphicsRef, maxAgeMs]);

  return { trailPointsRef, initTrail, addTrailPoint, clearTrail, drawTrail };
}
