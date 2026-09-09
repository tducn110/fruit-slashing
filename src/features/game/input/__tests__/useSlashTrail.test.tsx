// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Graphics, Container } from "pixi.js";
import { expect, it, vi } from "vitest";
import { useSlashTrail } from "../useSlashTrail";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("tracks, draws and clears trail points within bounds", () => {
  const g = new Graphics();
  const ref = { current: g };
  let trail!: ReturnType<typeof useSlashTrail>;
  function Probe() { trail = useSlashTrail({ trailGraphicsRef: ref, getMaxPoints: () => 12 }); return null; }
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));

  const clearSpy = vi.spyOn(g, "clear");
  const strokeSpy = vi.spyOn(g, "stroke");
  const now = vi.spyOn(performance, "now").mockReturnValue(1000);

  for (let i = 0; i < 30; i++) {
    now.mockReturnValue(1000 + i * 10);
    trail.addTrailPoint({ x: i * 2, y: i, t: 1000 + i * 10 });
    trail.drawTrail();
  }

  // Max points bounded to 12
  expect(trail.trailPointsRef.current).toHaveLength(12);
  expect(strokeSpy).toHaveBeenCalled();
  expect(clearSpy).toHaveBeenCalled();

  // Pruning after age expires
  now.mockReturnValue(2000);
  trail.drawTrail();
  expect(trail.trailPointsRef.current).toHaveLength(0);

  // Clear trail
  trail.addTrailPoint({ x: 10, y: 20, t: 2000 });
  expect(trail.trailPointsRef.current).toHaveLength(1);
  trail.clearTrail();
  expect(trail.trailPointsRef.current).toHaveLength(0);

  vi.restoreAllMocks();
  act(() => root.unmount());
  g.destroy();
});
