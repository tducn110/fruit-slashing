// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { usePixiApp } from "./usePixiApp";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

let lastResizeObserver: {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  trigger: () => void;
} | null = null;
const rafCallbacks = new Map<number, FrameRequestCallback>();
let rafId = 0;
const mockPieces = vi.hoisted(() => {
  class MockContainer {
    children: Array<MockContainer> = [];
    parent: MockContainer | null = null;
    destroyed = false;
    addChild(child: MockContainer) {
      this.children.push(child);
      child.parent = this;
      return child;
    }
    removeChildren() {
      this.children = [];
    }
    destroy() {
      this.destroyed = true;
    }
  }

  class MockGraphics extends MockContainer {}

  class MockApplication {
    canvas = document.createElement("canvas");
    stage = new MockContainer();
    renderer = {
      resize: vi.fn(),
    };
    destroy = vi.fn();
    init = vi.fn(async () => {});
  }

  return {
    MockContainer,
    MockGraphics,
    MockApplication,
    drawBackground: vi.fn(),
  };
});

vi.mock("pixi.js", () => ({
  Application: mockPieces.MockApplication,
  Container: mockPieces.MockContainer,
  Graphics: mockPieces.MockGraphics,
  Sprite: class Sprite extends mockPieces.MockContainer {},
}));

vi.mock("./fruitVisuals", () => ({
  drawBackground: mockPieces.drawBackground,
}));

class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    lastResizeObserver = {
      observe: this.observe,
      disconnect: this.disconnect,
      trigger: () => this.callback([], this as unknown as ResizeObserver),
    };
  }
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
  const id = ++rafId;
  rafCallbacks.set(id, callback);
  return id;
}) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((id: number) => {
  rafCallbacks.delete(id);
}) as typeof cancelAnimationFrame;

afterEach(() => {
  vi.clearAllMocks();
  rafCallbacks.clear();
  lastResizeObserver = null;
  rafId = 0;
});

function Probe({ onResize }: { onResize: (size: { w: number; h: number }) => void }) {
  const { wrapRef } = usePixiApp({ onViewportResize: onResize });
  return <div ref={wrapRef} />;
}

async function mountProbe(onResize: (size: { w: number; h: number }) => void) {
  const container = document.createElement("div");
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<Probe onResize={onResize} />);
  });
  return {
    container,
    root,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

it("coalesces repeated resize notifications into one viewport resize callback", async () => {
  const onResize = vi.fn();
  const mounted = await mountProbe(onResize);

  expect(lastResizeObserver).not.toBeNull();
  expect(mockPieces.drawBackground).toHaveBeenCalledTimes(1);

  const wrap = mounted.container.firstElementChild as HTMLDivElement;
  Object.defineProperty(wrap, "clientWidth", { configurable: true, value: 640 });
  Object.defineProperty(wrap, "clientHeight", { configurable: true, value: 360 });

  act(() => {
    lastResizeObserver?.trigger();
    lastResizeObserver?.trigger();
  });

  expect(rafCallbacks.size).toBe(1);
  const pending = [...rafCallbacks.values()][0];
  await act(async () => {
    pending(performance.now());
  });

  expect(onResize).toHaveBeenCalledTimes(1);
  expect(onResize).toHaveBeenCalledWith({ w: 640, h: 360 });
  expect(mockPieces.drawBackground).toHaveBeenCalledTimes(2);

  await mounted.unmount();
});
