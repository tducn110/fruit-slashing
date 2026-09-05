// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { createGame, getGameConfig } from "../../../game/core";
import { useGamePointerInput } from "./useGamePointerInput";
import type { TrailPoint } from "./useSlashTrail";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.restoreAllMocks());

it("keeps a queued drag sample and uses the latest callbacks across HUD/feedback renders", async () => {
  const host = document.createElement("div");
  const canvas = document.createElement("canvas");
  document.body.append(host, canvas);
  const rect = vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 390, height: 600 } as DOMRect);
  const add = vi.spyOn(canvas, "addEventListener");
  const remove = vi.spyOn(canvas, "removeEventListener");
  const frames = new Map<number, FrameRequestCallback>();
  let sequence = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(cb => { frames.set(++sequence, cb); return sequence; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(id => { frames.delete(id); });
  vi.spyOn(performance, "now").mockReturnValue(0);
  const points = { current: [] as TrailPoint[] };
  const refs = {
    canvas, gameStateRef: { current: createGame(123, getGameConfig(390)) },
    playingRef: { current: true }, startedAtRef: { current: 0 }, sizeRef: { current: { w: 390, h: 600 } },
  };
  const result = vi.fn();
  function Probe({ revision }: { revision: number }) {
    useGamePointerInput({ ...refs, trailPointsRef: points,
      addTrailPoint: point => points.current.push(point), clearTrail: () => { points.current = []; },
      onSliceResult: (...args) => result(revision, ...args),
    });
    return null;
  }
  const root = createRoot(host);
  await act(async () => root.render(<Probe revision={0} />));
  const pointer = (type: string, x: number) => canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 120 }));
  await act(async () => { pointer("pointerdown", 50); pointer("pointermove", 150); });
  const readsBeforeRender = rect.mock.calls.length;
  await act(async () => root.render(<Probe revision={1} />));
  await act(async () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(16)); });
  expect(points.current.at(-1)?.x).toBe(150);
  expect(result.mock.calls.at(-1)?.[0]).toBe(1);
  expect(add.mock.calls.filter(([type]) => type === "pointermove")).toHaveLength(1);
  expect(remove.mock.calls.filter(([type]) => type === "pointermove")).toHaveLength(0);
  expect(rect.mock.calls.length).toBe(readsBeforeRender);
  await act(async () => root.unmount());
  host.remove(); canvas.remove();
});
