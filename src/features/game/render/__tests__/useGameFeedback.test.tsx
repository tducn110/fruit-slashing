// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { Container } from "pixi.js";
import { useGameFeedback } from "../useGameFeedback";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

type Feedback = ReturnType<typeof useGameFeedback>;

function Probe({ onValue, maxPointTexts }: { onValue: (value: Feedback) => void; maxPointTexts?: number }) {
  onValue(useGameFeedback({ maxPointTexts }));
  return null;
}

async function mountProbe(onValue: (value: Feedback) => void, maxPointTexts?: number) {
  const container = document.createElement("div");
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<Probe onValue={onValue} maxPointTexts={maxPointTexts} />);
  });
  return {
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

it("ignores a Pixi layer that was destroyed before feedback cleanup", async () => {
  let feedback!: Feedback;
  const mounted = await mountProbe((value) => {
    feedback = value;
  });

  const position = {
    set: vi.fn(),
  };
  const layer = {
    destroyed: false,
    position,
  } as unknown as Container;

  act(() => {
    feedback.triggerPointFeedback({
      x: 10,
      y: 10,
      text: "+1",
      color: "#fff",
      variant: "points",
    });
    feedback.updateScreenShake(layer);
  });

  Object.defineProperty(layer, "destroyed", { value: true });
  position.set.mockImplementation(() => {
    throw new Error("destroyed Pixi layer");
  });

  expect(() => {
    act(() => feedback.clearFeedback());
  }).not.toThrow();

  await mounted.unmount();
});

it("bounds floating labels even when a single gesture produces a large combo burst", async () => {
  let feedback!: Feedback;
  const mounted = await mountProbe(value => { feedback = value; });
  await act(async () => {
    for (let i = 0; i < 40; i++) {
      feedback.triggerPointFeedback({ x: i, y: 100, text: `+${i}`, color: "#fff", variant: "combo" });
    }
  });
  act(() => feedback.flushFeedback());
  expect(feedback.pointTexts).toHaveLength(15);
  expect(feedback.pointTexts.at(-1)?.text).toBe("+39");
  await mounted.unmount();
});

it("merges separate async input turns and expiration into the ticker commit", async () => {
  let feedback!: Feedback;
  let renders = 0;
  const mounted = await mountProbe(value => { feedback = value; renders++; });
  const now = vi.spyOn(performance, "now").mockReturnValue(1000);
  const add = () => feedback.triggerPointFeedback({ x: 1, y: 2, text: "+1", color: "white" });
  await act(async () => { add(); await Promise.resolve(); add(); });
  expect(renders).toBe(1);
  act(() => feedback.flushFeedback());
  expect(renders).toBe(2);
  expect(feedback.pointTexts).toHaveLength(2);
  now.mockReturnValue(1801);
  await act(async () => { add(); await Promise.resolve(); });
  expect(renders).toBe(2);
  act(() => feedback.flushFeedback());
  expect(renders).toBe(3);
  expect(feedback.pointTexts).toHaveLength(1);
  act(() => feedback.flushFeedback());
  expect(renders).toBe(3);
  await mounted.unmount();
});

it("uses the session label budget and expires labels without timer commits", async () => {
  let feedback!: Feedback;
  const mounted = await mountProbe(value => { feedback = value; }, 4);
  const now = vi.spyOn(performance, "now").mockReturnValue(1000);
  act(() => {
    for (let i = 0; i < 100; i++) feedback.triggerPointFeedback({ x: i, y: 1, text: `+${i}`, color: "white" });
    feedback.flushFeedback();
  });
  expect(feedback.pointTexts).toHaveLength(4);
  expect(feedback.pointTexts[0].text).toBe("+96");
  now.mockReturnValue(2000);
  act(() => feedback.flushFeedback());
  expect(feedback.pointTexts).toHaveLength(0);
  await mounted.unmount();
});
