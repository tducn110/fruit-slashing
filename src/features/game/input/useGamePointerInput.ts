import { useEffect, useRef, type RefObject } from "react";
import type { GameState, SliceResult, TrailSegment } from "../../../game/core";
import {
  elapsedTick,
  getWorldRenderTransform,
  normalizePointer,
  applyInput,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from "../../../game/core";
import type { TrailPoint } from "./useSlashTrail";

interface UseGamePointerInputOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  gameStateRef: RefObject<GameState | null>;
  playingRef: RefObject<boolean>;
  startedAtRef: RefObject<number>;
  sizeRef: RefObject<{ w: number; h: number }>;
  addTrailPoint: (point: TrailPoint) => void;
  clearTrail: () => void;
  trailPointsRef: RefObject<TrailPoint[]>;
  onSliceResult: (
    results: SliceResult[],
    prevPoint: TrailPoint | undefined,
    screenX: number,
    screenY: number
  ) => void;
}

interface UseGamePointerInputResult {
  pointerDownRef: RefObject<boolean>;
}

export function useGamePointerInput({
  canvasRef,
  gameStateRef,
  playingRef,
  startedAtRef,
  sizeRef,
  addTrailPoint,
  clearTrail,
  trailPointsRef,
  onSliceResult,
}: UseGamePointerInputOptions): UseGamePointerInputResult {
  const pointerDownRef = useRef(false);
  const trailSegmentsScratchRef = useRef<TrailSegment[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let moveFrame = 0;
    let pendingMove: { clientX: number; clientY: number } | null = null;

    function handlePointer(clientX: number, clientY: number) {
      const state = gameStateRef.current;
      const size = sizeRef.current;
      const trailPoints = trailPointsRef.current;
      const startedAt = startedAtRef.current;

      if (!size || !trailPoints || startedAt === null || startedAt === undefined) return;

      const rect = canvas!.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const screenX = (clientX - rect.left) * (size.w / rect.width);
      const screenY = (clientY - rect.top) * (size.h / rect.height);
      const now = performance.now();
      const previousTrail = trailPoints.at(-1);

      addTrailPoint({ x: screenX, y: screenY, t: now });

      if (!playingRef.current || !state) return;

      const tick = elapsedTick(now - startedAt);
      const transform = getWorldRenderTransform(size.w, size.h);
      const worldPoint = {
        x: (screenX - transform.offsetX) / transform.scaleX + WORLD_WIDTH / 2,
        y: (screenY - transform.offsetY) / transform.scaleY + WORLD_HEIGHT / 2,
      };
      const sample = normalizePointer(
        worldPoint.x,
        worldPoint.y,
        WORLD_WIDTH,
        WORLD_HEIGHT,
        tick
      );

      // Collision only needs the newest ten points. Build that small list
      // directly instead of mapping the complete trail on every pointer frame.
      const trailSegments = trailSegmentsScratchRef.current;
      trailSegments.length = 0;
      const firstPoint = Math.max(0, trailPoints.length - 10);
      for (let index = firstPoint; index < trailPoints.length; index += 1) {
        const point = trailPoints[index];
        const segmentIndex = index - firstPoint;
        const segment = trailSegments[segmentIndex] ?? { x: 0, y: 0 };
        segment.x = (point.x - transform.offsetX) / transform.scaleX + WORLD_WIDTH / 2;
        segment.y = (point.y - transform.offsetY) / transform.scaleY + WORLD_HEIGHT / 2;
        trailSegments[segmentIndex] = segment;
      }

      const results = applyInput(state, sample, trailSegments, state.config);

      onSliceResult(results, previousTrail, screenX, screenY);
    }

    const handlePointerDown = (event: PointerEvent) => {
      pointerDownRef.current = true;
      handlePointer(event.clientX, event.clientY);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerDownRef.current) return;
      pendingMove = { clientX: event.clientX, clientY: event.clientY };
      if (moveFrame) return;
      moveFrame = window.requestAnimationFrame(() => {
        moveFrame = 0;
        const next = pendingMove;
        pendingMove = null;
        if (!pointerDownRef.current || !next) return;
        handlePointer(next.clientX, next.clientY);
      });
    };

    const handlePointerUp = () => {
      if (pendingMove) {
        const next = pendingMove;
        pendingMove = null;
        if (moveFrame) {
          window.cancelAnimationFrame(moveFrame);
          moveFrame = 0;
        }
        handlePointer(next.clientX, next.clientY);
      }
      pointerDownRef.current = false;
      clearTrail();
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      if (moveFrame) window.cancelAnimationFrame(moveFrame);
    };
  }, [
    canvasRef,
    gameStateRef,
    playingRef,
    startedAtRef,
    sizeRef,
    addTrailPoint,
    clearTrail,
    trailPointsRef,
    onSliceResult,
  ]);

  return {
    pointerDownRef,
  };
}
