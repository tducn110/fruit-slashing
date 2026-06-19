import { useEffect, useRef, type RefObject } from "react";
import type { Application, Ticker } from "pixi.js";
import type { GameResult } from "../../../game/types";
import type { GameState } from "../../../game/core";
import { elapsedTick, advanceToTick, TICK_RATE } from "../../../game/core";

export interface UseGameTickerOptions {
  enabled: boolean;
  appRef: RefObject<Application | null>;
  gameStateRef: RefObject<GameState | null>;
  playingRef: RefObject<boolean>;
  startedAtRef: RefObject<number>;
  sizeRef: RefObject<{ w: number; h: number }>;
  destroyedRef: RefObject<boolean>;
  playLayerRef: RefObject<any>; // Graphics/Container
  syncFruitSprites: (state: GameState) => void;
  updateParticles: (deltaSec: number, height: number) => void;
  updateScreenShake: (playLayer: any) => void;
  drawTrail: () => void;
  syncHud: (state: GameState) => void;
  finishGame: (result: GameResult) => void;
}

export function useGameTicker({
  enabled,
  appRef,
  gameStateRef,
  playingRef,
  startedAtRef,
  sizeRef,
  destroyedRef,
  playLayerRef,
  syncFruitSprites,
  updateParticles,
  updateScreenShake,
  drawTrail,
  syncHud,
  finishGame,
}: UseGameTickerOptions): void {
  // Pattern A: Stable refs for callbacks to avoid re-binding ticker every render
  const callbacksRef = useRef({
    syncFruitSprites,
    updateParticles,
    updateScreenShake,
    drawTrail,
    syncHud,
    finishGame,
  });

  useEffect(() => {
    callbacksRef.current = {
      syncFruitSprites,
      updateParticles,
      updateScreenShake,
      drawTrail,
      syncHud,
      finishGame,
    };
  }, [
    syncFruitSprites,
    updateParticles,
    updateScreenShake,
    drawTrail,
    syncHud,
    finishGame,
  ]);

  const gameOverHandledRef = useRef(false);

  useEffect(() => {
    const app = appRef.current;
    if (!app || !enabled) return;

    function tick(ticker: Ticker) {
      if (destroyedRef.current) return;

      const state = gameStateRef.current;
      const startedAt = startedAtRef.current;
      const size = sizeRef.current;

      if (playingRef.current && state && startedAt !== null && startedAt !== undefined) {
        if (!state.ended) {
          gameOverHandledRef.current = false;
        }

        advanceToTick(state, elapsedTick(performance.now() - startedAt));
        callbacksRef.current.syncFruitSprites(state);

        if (ticker.lastTime % 250 < ticker.deltaMS) {
          callbacksRef.current.syncHud(state);
        }

        if (state.ended && !gameOverHandledRef.current) {
          gameOverHandledRef.current = true;
          const playTimeSec = Math.min(180, Math.floor(state.tick / TICK_RATE));
          const result: GameResult = {
            score: state.score,
            playTimeSec,
            endReason: state.endReason ?? undefined,
          };
          callbacksRef.current.finishGame(result);
          callbacksRef.current.syncHud(state);
        }
      }

      if (size) {
        callbacksRef.current.updateParticles(ticker.deltaMS / 1000, size.h);
      }
      callbacksRef.current.updateScreenShake(playLayerRef.current);
      callbacksRef.current.drawTrail();
    }

    app.ticker.add(tick);

    return () => {
      app.ticker.remove(tick);
    };
  }, [appRef, enabled, destroyedRef, gameStateRef, playingRef, startedAtRef, sizeRef, playLayerRef]);
}
