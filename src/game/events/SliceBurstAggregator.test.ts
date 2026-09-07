import { describe, it, expect, beforeEach } from "vitest";
import {
  SliceBurstAggregator,
  DEFAULT_SLICE_BURST_WINDOW_MS,
} from "./SliceBurstAggregator";
import type { SliceResult } from "../core";

function makeSliceResult(id: number, kind: "mango" | "banana" | "bomb" = "mango"): SliceResult {
  return {
    fruit: {
      id,
      kind,
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      rotation: 0,
      rotationVelocity: 0,
      radius: 30,
    },
    points: 10,
    combo: 1,
    lives: 3,
  };
}

describe("SliceBurstAggregator", () => {
  let aggregator: SliceBurstAggregator;

  beforeEach(() => {
    aggregator = new SliceBurstAggregator({
      windowMs: DEFAULT_SLICE_BURST_WINDOW_MS,
    });
  });

  it("Case A: t=0 fruit A -> BURST_STARTED count=1", () => {
    const events = aggregator.push([makeSliceResult(1, "mango")], 0);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BURST_STARTED",
      burstId: 1,
      timeMs: 0,
      count: 1,
      fruits: [{ id: 1, kind: "mango" }],
    });
    expect(aggregator.isInBurst).toBe(true);
    expect(aggregator.currentCount).toBe(1);
  });

  it("Case B: t=0 fruit A, t=20 fruit B -> same burst count=2", () => {
    aggregator.push([makeSliceResult(1, "mango")], 0);
    const events = aggregator.push([makeSliceResult(2, "banana")], 20);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BURST_EXTENDED",
      burstId: 1,
      timeMs: 20,
      count: 2,
      newCount: 1,
      fruits: [{ id: 2, kind: "banana" }],
    });
    expect(aggregator.isInBurst).toBe(true);
    expect(aggregator.currentCount).toBe(2);
  });

  it("Case C: t=0 fruit A, t=20 fruit B, t=40 fruit C -> same burst count=3", () => {
    aggregator.push([makeSliceResult(1, "mango")], 0);
    aggregator.push([makeSliceResult(2, "banana")], 20);
    const events = aggregator.push([makeSliceResult(3, "mango")], 40);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BURST_EXTENDED",
      burstId: 1,
      timeMs: 40,
      count: 3,
      newCount: 1,
    });
    expect(aggregator.currentCount).toBe(3);
  });

  it("Case D: t=0 fruit A, t > WINDOW fruit B -> burst A ends, new burst B starts", () => {
    aggregator.push([makeSliceResult(1, "mango")], 0);

    // t = 0 + WINDOW + 10 ms (e.g. 75ms with 65ms window)
    const tOverWindow = DEFAULT_SLICE_BURST_WINDOW_MS + 10;
    const events = aggregator.push([makeSliceResult(2, "banana")], tOverWindow);

    expect(events).toHaveLength(2);
    // 1st event: previous burst closed
    expect(events[0]).toMatchObject({
      type: "BURST_ENDED",
      burstId: 1,
      timeMs: tOverWindow,
      totalCount: 1,
    });
    // 2nd event: new burst starts
    expect(events[1]).toMatchObject({
      type: "BURST_STARTED",
      burstId: 2,
      timeMs: tOverWindow,
      count: 1,
    });
    expect(aggregator.activeBurstId).toBe(2);
    expect(aggregator.currentCount).toBe(1);
  });

  it("Case E: two fruits in same SliceResult[] -> one burst count=2", () => {
    const events = aggregator.push(
      [makeSliceResult(1, "mango"), makeSliceResult(2, "banana")],
      0
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BURST_STARTED",
      burstId: 1,
      timeMs: 0,
      count: 2,
      fruits: [
        { id: 1, kind: "mango" },
        { id: 2, kind: "banana" },
      ],
    });
    expect(aggregator.currentCount).toBe(2);
  });

  it("Case F: fruit then bomb -> bomb priority event and cancels burst", () => {
    aggregator.push([makeSliceResult(1, "mango")], 0);
    const events = aggregator.push([makeSliceResult(99, "bomb")], 25);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "BOMB_HIT",
      burstId: 1,
      timeMs: 25,
      bombFruitId: 99,
      burstFruitCountBeforeBomb: 1,
    });
    expect(aggregator.isInBurst).toBe(false);
    expect(aggregator.currentCount).toBe(0);

    // Further update should not emit BURST_ENDED because bomb already closed it
    const updateEvents = aggregator.update(100);
    expect(updateEvents).toHaveLength(0);
  });

  it("Case G: pause/time behavior -> purely deterministic based on nowMs, no real timer dependency", () => {
    // Game is active, fruit sliced at gameplay time 100ms
    aggregator.push([makeSliceResult(1, "mango")], 100);
    expect(aggregator.isInBurst).toBe(true);

    // Game pauses at 120ms. In real life 2000ms elapsed, but gameplay time stays at 120ms.
    // Ticker does not run. Even if update is called with 120ms:
    const pauseEvents = aggregator.update(120);
    expect(pauseEvents).toHaveLength(0);
    expect(aggregator.isInBurst).toBe(true);

    // Game resumes at 120ms gameplay time, fruit sliced at 135ms (15ms after pause)
    const resumeEvents = aggregator.push([makeSliceResult(2, "banana")], 135);
    expect(resumeEvents).toHaveLength(1);
    expect(resumeEvents[0].type).toBe("BURST_EXTENDED");
    expect(aggregator.currentCount).toBe(2);

    // Gameplay time advances past window without new slices -> burst closes
    const closeEvents = aggregator.update(135 + DEFAULT_SLICE_BURST_WINDOW_MS + 1);
    expect(closeEvents).toHaveLength(1);
    expect(closeEvents[0].type).toBe("BURST_ENDED");
    expect(closeEvents[0]).toMatchObject({
      burstId: 1,
      totalCount: 2,
    });
    expect(aggregator.isInBurst).toBe(false);
  });

  it("Case H: flush and reset -> no stale state survives restart/game-over", () => {
    aggregator.push([makeSliceResult(1, "mango")], 10);
    expect(aggregator.isInBurst).toBe(true);

    // Flush on game end
    const flushed = aggregator.flush(50);
    expect(flushed).toHaveLength(1);
    expect(flushed[0].type).toBe("BURST_ENDED");
    expect(aggregator.isInBurst).toBe(false);

    // Push into another burst, then reset on restart
    aggregator.push([makeSliceResult(2, "banana")], 60);
    expect(aggregator.isInBurst).toBe(true);
    aggregator.reset();
    expect(aggregator.isInBurst).toBe(false);
    expect(aggregator.currentCount).toBe(0);

    // Update after reset produces no events
    expect(aggregator.update(200)).toHaveLength(0);
  });
});
