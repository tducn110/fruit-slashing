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

function Probe({ onValue }: { onValue: (value: Feedback) => void }) {
  onValue(useGameFeedback());
  return null;
}

async function mountProbe(onValue: (value: Feedback) => void) {
  const container = document.createElement("div");
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<Probe onValue={onValue} />);
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
  expect(feedback.pointTexts).toHaveLength(15);
  expect(feedback.pointTexts.at(-1)?.text).toBe("+39");
  await mounted.unmount();
});
