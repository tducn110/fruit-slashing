// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { createGame, getGameConfig } from "../../../game/core";
import { useGameTicker } from "./useGameTicker";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.restoreAllMocks();
});

it("does not advance core state, particles, or render effects while host-paused", async () => {
  let tick: ((ticker: { lastTime: number; deltaMS: number }) => void) | null =
    null;
  const ticker = {
    add: vi.fn((callback) => {
      tick = callback;
    }),
    remove: vi.fn(),
  };
  const appRef = {
    current: {
      ticker,
      stage: {},
    },
  };
  const gameStateRef = {
    current: createGame(123456, getGameConfig(390)),
  };
  const playingRef = { current: true };
  const startedAtRef = { current: 0 };
  const hostPausedRef = { current: true };
  const syncFruitSprites = vi.fn();
  const updateParticles = vi.fn();
  const updateScreenShake = vi.fn();
  const drawTrail = vi.fn();
  const syncHud = vi.fn();
  const finishGame = vi.fn();
  vi.spyOn(performance, "now").mockReturnValue(1_000);

  function Probe() {
    useGameTicker({
      enabled: true,
      appRef: appRef as never,
      gameStateRef,
      playingRef,
      startedAtRef,
      hostPausedRef,
      sizeRef: { current: { w: 390, h: 600 } },
      destroyedRef: { current: false },
      playLayerRef: { current: {} },
      syncFruitSprites,
      updateParticles,
      updateScreenShake,
      drawTrail,
      syncHud,
      finishGame,
    });
    return null;
  }

  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<Probe />));
  expect(tick).not.toBeNull();

  const initialTick = gameStateRef.current.tick;
  act(() => tick?.({ lastTime: 1_000, deltaMS: 16 }));
  expect(gameStateRef.current.tick).toBe(initialTick);
  expect(syncFruitSprites).not.toHaveBeenCalled();
  expect(updateParticles).not.toHaveBeenCalled();
  expect(updateScreenShake).not.toHaveBeenCalled();
  expect(drawTrail).not.toHaveBeenCalled();

  hostPausedRef.current = false;
  act(() => tick?.({ lastTime: 1_016, deltaMS: 16 }));
  expect(gameStateRef.current.tick).toBeGreaterThan(initialTick);
  expect(syncFruitSprites).toHaveBeenCalled();
  expect(updateParticles).toHaveBeenCalled();

  const resumedTick = gameStateRef.current.tick;
  hostPausedRef.current = true;
  act(() => tick?.({ lastTime: 2_000, deltaMS: 16 }));
  expect(gameStateRef.current.tick).toBe(resumedTick);

  await act(async () => root.unmount());
  container.remove();
  expect(ticker.remove).toHaveBeenCalledTimes(1);
});
