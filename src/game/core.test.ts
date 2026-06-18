import { describe, expect, it } from "vitest";
import {
  GAME_DURATION_MS,
  TICK_MS,
  advanceToTick,
  applyInput,
  createGame,
  elapsedTick,
  isValidInputLog,
  replayGame,
  timeLeftSeconds,
  rankFor,
  type InputSample,
} from "./core";

describe("deterministic game core", () => {
  it("produces the same state for the same seed and input", () => {
    const input: InputSample[] = [
      { tick: 80, x: 5000, y: 5000 },
      { tick: 120, x: 4500, y: 3500 },
      { tick: 200, x: 6000, y: 2000 },
    ];
    expect(replayGame(12345, input)).toEqual(replayGame(12345, input));
  });

  it("ends exactly at the configured duration", () => {
    const state = createGame(1);
    advanceToTick(state, elapsedTick(GAME_DURATION_MS));
    expect(state.ended).toBe(true);
    expect(timeLeftSeconds(state)).toBe(0);
    expect(state.tick * TICK_MS).toBeCloseTo(GAME_DURATION_MS);
  });

  it("scores fruit and applies combo multipliers", () => {
    const state = createGame(1);
    state.fruits = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      kind: "mango" as const,
      x: 500,
      y: 300,
      vx: 0,
      vy: 0,
      rotation: 0,
      rotationVelocity: 0,
      radius: 34,
    }));
    const hits = applyInput(state, { tick: 0, x: 5000, y: 5000 });
    expect(hits).toHaveLength(5);
    expect(state.combo).toBe(5);
    expect(state.score).toBe(18);
  });

  it("ends after slicing three bombs", () => {
    const state = createGame(1);
    state.fruits = Array.from({ length: 3 }, (_, index) => ({
      id: index + 1,
      kind: "bomb" as const,
      x: 500,
      y: 300,
      vx: 0,
      vy: 0,
      rotation: 0,
      rotationVelocity: 0,
      radius: 30,
    }));
    applyInput(state, { tick: 0, x: 5000, y: 5000 });
    expect(state.lives).toBe(0);
    expect(state.ended).toBe(true);
  });

  it("rejects malformed, oversized, and non-monotonic input logs", () => {
    expect(isValidInputLog([{ tick: 2, x: 0, y: 0 }, { tick: 1, x: 0, y: 0 }])).toBe(false);
    expect(isValidInputLog([{ tick: 1, x: -1, y: 0 }])).toBe(false);
    expect(isValidInputLog(Array.from({ length: 6001 }, () => ({ tick: 1, x: 0, y: 0 })))).toBe(false);
  });

  it("maps score boundaries to ranks", () => {
    expect(rankFor(99)).toBe("Tập Sự");
    expect(rankFor(100)).toBe("Lính Mới");
    expect(rankFor(250)).toBe("Cao Thủ");
    expect(rankFor(400)).toBe("Vua Chém");
  });
});
