import { describe, expect, it } from "vitest";
import { advanceToTick, createGame, getGameConfig, screenToWorld } from "./core";

describe("fruit trajectory", () => {
  it("reaches each generated target peak within one world unit", () => {
    const state = createGame(123456, getGameConfig(390));
    const completed: Array<{ targetPeakY: number; minYReached: number }> = [];

    for (let tick = 1; tick <= 600 && completed.length < 5; tick += 1) {
      const previous = new Map(state.fruits.map((fruit) => [fruit.id, fruit]));
      advanceToTick(state, tick);
      const activeIds = new Set(state.fruits.map((fruit) => fruit.id));

      for (const fruit of previous.values()) {
        if (
          !activeIds.has(fruit.id)
          && fruit.targetPeakY !== undefined
          && fruit.minYReached !== undefined
        ) {
          completed.push({
            targetPeakY: fruit.targetPeakY,
            minYReached: fruit.minYReached,
          });
        }
      }
    }

    expect(completed.length).toBeGreaterThanOrEqual(5);
    for (const fruit of completed) {
      expect(Math.abs(fruit.minYReached - fruit.targetPeakY)).toBeLessThan(1);
    }
  });

  it("ramps fruit movement speed as the run gets harder", () => {
    const state = createGame(123456, getGameConfig(390));

    advanceToTick(state, 65);
    const earlyGravityScale = state.fruits.at(-1)?.gravityScale ?? 1;

    advanceToTick(state, 4200);
    const lateGravityScale = Math.max(...state.fruits.map((fruit) => fruit.gravityScale ?? 1));

    expect(earlyGravityScale).toBeLessThan(0.5);
    expect(lateGravityScale).toBeGreaterThan(earlyGravityScale);
  });


  it("inverts centered letterboxed rendering coordinates", () => {
    const viewport = { width: 1920, height: 1080 };
    const worldCenter = screenToWorld(960, 540, viewport.width, viewport.height);
    expect(worldCenter.x).toBeCloseTo(500);
    expect(worldCenter.y).toBeCloseTo(300);

    const worldLeftEdge = screenToWorld(60, 540, viewport.width, viewport.height);
    expect(worldLeftEdge.x).toBeCloseTo(0);
    expect(worldLeftEdge.y).toBeCloseTo(300);
  });
});
