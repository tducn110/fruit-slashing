// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  finalizeGameResult,
  type GameResult,
} from "../../../game/types";
import {
  useGameSession,
  type UseGameSessionOptions,
} from "./useGameSession";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

const ROUND_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function Probe({
  options,
  onValue,
}: {
  options: UseGameSessionOptions;
  onValue: (value: ReturnType<typeof useGameSession>) => void;
}) {
  onValue(useGameSession(options));
  return null;
}

async function mountProbe(
  options: UseGameSessionOptions,
  onValue: (value: ReturnType<typeof useGameSession>) => void,
) {
  const container = document.createElement("div");
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<Probe options={options} onValue={onValue} />);
  });
  return {
    rerender: async (nextOptions: UseGameSessionOptions) => {
      await act(async () => {
        root.render(<Probe options={nextOptions} onValue={onValue} />);
      });
    },
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useGameSession round identity", () => {
  it("keeps one round id through revive/finalize and creates a new id for a new round", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    let latest!: ReturnType<typeof useGameSession>;
    const mounted = await mountProbe({ onComplete }, (value) => {
      latest = value;
    });

    await act(async () => {
      latest.startSession();
    });
    const firstRoundId = latest.roundId;
    expect(firstRoundId).toMatch(ROUND_ID_PATTERN);
    await act(async () => {
      latest.startSession();
    });
    expect(latest.roundId).toBe(firstRoundId);

    const firstResult: GameResult = { score: 10, playTimeSec: 2 };
    await act(async () => {
      latest.finishGame(firstResult);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ ...firstResult, roundId: firstRoundId }),
    );
    expect(latest.finalResult).toMatchObject({
      ...firstResult,
      roundId: firstRoundId,
    });

    await act(async () => {
      latest.finishGame({ score: 11, playTimeSec: 3 });
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(latest.finalResult).toMatchObject({
      ...firstResult,
      roundId: firstRoundId,
    });

    await act(async () => {
      latest.resumeSession(2_000);
    });
    expect(latest.roundId).toBe(firstRoundId);
    await act(async () => {
      latest.finishGame({ score: 20, playTimeSec: 5 });
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(latest.finalResult).toMatchObject({
      score: 20,
      playTimeSec: 5,
      roundId: firstRoundId,
    });

    await act(async () => {
      latest.resetSession();
      latest.startSession();
    });
    expect(latest.roundId).toMatch(ROUND_ID_PATTERN);
    expect(latest.roundId).not.toBe(firstRoundId);

    await mounted.unmount();
  });

  it("applies the score multiplier only to the final score payload", () => {
    const initial: GameResult = {
      score: 35,
      playTimeSec: 9,
      roundId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };
    const finalized = finalizeGameResult(initial, 2);

    expect(initial.score).toBe(35);
    expect(finalized).toMatchObject({
      score: 70,
      playTimeSec: 9,
      roundId: initial.roundId,
      qualifies: true,
    });
  });

  it("keeps completion callback independent from final score submission", async () => {
    const onComplete = vi.fn();
    const onGameOver = vi.fn(() => {
      throw new Error("score operation failed");
    });
    let latest!: ReturnType<typeof useGameSession>;
    const mounted = await mountProbe({ onComplete, onGameOver }, (value) => {
      latest = value;
    });

    await act(async () => latest.startSession());
    await act(async () => {
      latest.finishGame({ score: 5, playTimeSec: 1 });
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(latest.finalResult).toMatchObject({ score: 5 });
    await mounted.unmount();
  });

  it("freezes countdown while host-paused and resumes without skipping a step", async () => {
    vi.useFakeTimers();
    let latest!: ReturnType<typeof useGameSession>;
    const mounted = await mountProbe({ hostPaused: true }, (value) => {
      latest = value;
    });

    await act(async () => {
      latest.startCountdown();
    });
    expect(latest.countdown).toBe(3);
    await act(async () => {
      vi.advanceTimersByTime(2_100);
    });
    expect(latest.countdown).toBe(3);

    await mounted.rerender({ hostPaused: false });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect(latest.countdown).toBe(2);
    await mounted.unmount();
  });

  it("compensates the game clock once across duplicate pause/resume events", async () => {
    let now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    let latest!: ReturnType<typeof useGameSession>;
    const mounted = await mountProbe({ hostPaused: false }, (value) => {
      latest = value;
    });

    await act(async () => latest.startSession());
    const roundId = latest.roundId;
    expect(latest.startedAtRef.current).toBe(1_000);

    now = 1_500;
    await mounted.rerender({ hostPaused: true });
    expect(latest.hostPausedRef.current).toBe(true);
    expect(latest.playingRef.current).toBe(false);

    now = 6_500;
    await mounted.rerender({ hostPaused: false });
    expect(latest.hostPausedRef.current).toBe(false);
    expect(latest.playingRef.current).toBe(true);
    expect(latest.startedAtRef.current).toBe(6_000);
    expect(latest.roundId).toBe(roundId);

    now = 7_000;
    await mounted.rerender({ hostPaused: false });
    expect(latest.startedAtRef.current).toBe(6_000);
    expect(latest.roundId).toBe(roundId);
    await mounted.unmount();
  });
});
