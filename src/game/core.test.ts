import { describe, expect, it } from "vitest";
import { advanceToTick, createGame, getGameConfig, screenToWorld, getWorldRenderTransform, applyInputAtCurrentTick, normalizePointer } from "./core";

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

 it("retains the fruit array while removing expired fruit over fixed ticks", () => {
  const state = createGame(123456, getGameConfig(390));
  const fruits = state.fruits;
  advanceToTick(state, 5000);
  expect(state.fruits).toBe(fruits);
  expect(state.fruits.every(fruit => fruit.y <= 700)).toBe(true);
});

it("projects continuously across portrait and width thresholds", () => {
  for (const [w,h,dw,dh] of [[390,526,0,1],[640,900,1,0]]) {
    const a = getWorldRenderTransform(w,h);
    const b = getWorldRenderTransform(w+dw,h+dh);
    expect(Math.abs(a.scaleY-b.scaleY)).toBeLessThan(.02);
    expect(Math.abs(a.scaleX-b.scaleX)).toBeLessThan(.02);
  }
});

it("uses a circular screen hitbox for portrait fruit and bombs", () => {
  for (const kind of ["lychee", "bomb"] as const) {
    for (const [dx,dy,expected] of [[0,50,0],[50,0,0],[0,10,1],[10,0,1]]) {
      const state = createGame(42, getGameConfig(390));
      state.fruits.push({ id: 1, kind, x:500,y:300,radius:26,vx:0,vy:0,rotation:0,rotationVelocity:0 });
      const point = screenToWorld(195+dx,394.5+dy,390,789);
      const t = getWorldRenderTransform(390,789);
      const results = applyInputAtCurrentTick(state,normalizePointer(point.x,point.y,1000,600,999),[],state.config,t.scaleY/t.scaleX);
      expect(results).toHaveLength(expected);
      expect(state.tick).toBe(0);
    }
  }
});
