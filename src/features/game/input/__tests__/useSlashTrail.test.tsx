// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Graphics, Container } from "pixi.js";
import { expect, it, vi } from "vitest";
import { useSlashTrail } from "../useSlashTrail";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("reuses prewarmed Pixi geometry across long strokes, fade, clear and restart", () => {
  const parent = new Container();
  const ref = { current: parent };
  let trail!: ReturnType<typeof useSlashTrail>;
  function Probe() { trail = useSlashTrail({ trailGraphicsRef: ref, getMaxPoints: () => 12 }); return null; }
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
  trail.initTrail();
  const children = [...parent.children] as Graphics[];
  expect(children).toHaveLength(44);
  const contexts = children.map(child => child.context);
  const clear = vi.spyOn(Graphics.prototype, "clear");
  const stroke = vi.spyOn(Graphics.prototype, "stroke");
  const fill = vi.spyOn(Graphics.prototype, "fill");
  const now = vi.spyOn(performance, "now").mockReturnValue(1000);
  for (let i = 0; i < 300; i++) {
    now.mockReturnValue(1000 + i);
    trail.addTrailPoint({ x: i * 2, y: i, t: 1000 + i });
    trail.drawTrail();
  }
  expect(trail.trailPointsRef.current).toHaveLength(12);
  expect(children.filter(child => child.visible)).toHaveLength(44);
  const firstAlpha = children.find(child => child.visible)!.alpha;
  now.mockReturnValue(1450);
  trail.drawTrail();
  expect(children.find(child => child.visible)!.alpha).toBeLessThan(firstAlpha);
  now.mockReturnValue(2000);
  trail.drawTrail();
  expect(children.every(child => !child.visible)).toBe(true);
  trail.clearTrail();
  trail.initTrail();
  expect(parent.children).toEqual(children);
  expect(children.map(child => child.context)).toEqual(contexts);
  expect(clear).not.toHaveBeenCalled();
  expect(stroke).not.toHaveBeenCalled();
  expect(fill).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  act(() => root.unmount());
  parent.destroy({ children: true });
});
