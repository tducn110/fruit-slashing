import { useEffect, useRef, type RefObject } from "react";
import type { GameState, SliceResult, TrailSegment } from "../../../game/core";
import {
  elapsedTick,
  screenToWorld,
  normalizePointer,
  getGameConfig,
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
      const worldPoint = screenToWorld(
        screenX,
        screenY,
        size.w,
        size.h
      );
      const sample = normalizePointer(
        worldPoint.x,
        worldPoint.y,
        WORLD_WIDTH,
        WORLD_HEIGHT,
        tick
      );

      const trailSegments: TrailSegment[] = trailPoints.map((p) =>
        screenToWorld(p.x, p.y, size.w, size.h)
      );

      const config = getGameConfig(size.w);
      const results = applyInput(state, sample, trailSegments, config);

      onSliceResult(results, previousTrail, screenX, screenY);
    }

    const handlePointerDown = (event: PointerEvent) => {
      pointerDownRef.current = true;
      handlePointer(event.clientX, event.clientY);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!pointerDownRef.current) return;
      handlePointer(event.clientX, event.clientY);
    };

    const handlePointerUp = () => {
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
