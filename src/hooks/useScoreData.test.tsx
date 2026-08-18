// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScoreData } from "./useScoreData";
import type {
  RedactedWinkState,
  WinkIntegration,
  WinkLeaderboardEntry,
} from "../integrations/wink/types";
import type { GameResult } from "../game/types";

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

const ROUND_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const READY_ANONYMOUS: RedactedWinkState = {
  phase: "ready_anonymous",
  gameId: "11111111-1111-4111-8111-111111111111",
  environment: "dev",
  sessionId: "33333333-3333-4333-8333-333333333331",
  identityType: "anonymous",
  capabilities: {
    getLeaderboard: true,
    submitScore: false,
    complete: true,
  },
  expiresAt: "2026-07-29T15:05:00.000Z",
  lifecycle: { paused: false, muted: false },
  error: null,
};

const REMOTE_ENTRIES: readonly WinkLeaderboardEntry[] = [
  {
    rank: 1,
    score: 720,
    playTime: 92,
    displayName: "Cao Thủ",
    avatarUrl: null,
    createdAt: "2026-07-29T15:00:00.000Z",
  },
  {
    rank: 2,
    score: 610,
    playTime: null,
    displayName: null,
    avatarUrl: null,
    createdAt: "2026-07-29T14:00:00.000Z",
  },
];

function makeIntegration(
  overrides: Partial<WinkIntegration> = {},
): WinkIntegration {
  const getLeaderboard = vi.fn(async () => ({
    entries: REMOTE_ENTRIES,
    me: null,
  }));
  const submitFinalScore = vi.fn(async () => undefined);
  const completeRound = vi.fn(async () => undefined);
  const base: WinkIntegration = {
    mode: "wink",
    phase: READY_ANONYMOUS.phase,
    capabilities: READY_ANONYMOUS.capabilities,
    state: READY_ANONYMOUS,
    client: {
      subscribe: () => () => {},
      getState: () => READY_ANONYMOUS,
      getCapabilities: () => READY_ANONYMOUS.capabilities,
      getLeaderboard,
      submitScore: async () => undefined,
      complete: async () => undefined,
      onPause: () => () => {},
      onResume: () => () => {},
      onMute: () => () => {},
      onUnmute: () => () => {},
      help: () => ({
        bridgeVersion: "9.0.1",
        protocolVersion: 1,
        phase: READY_ANONYMOUS.phase,
        gameId: READY_ANONYMOUS.gameId,
        environment: READY_ANONYMOUS.environment,
        hasSession: true,
        capabilities: READY_ANONYMOUS.capabilities,
        lifecycle: READY_ANONYMOUS.lifecycle,
        errorCode: null,
      }),
    },
    hostPaused: false,
    parentMuted: false,
    error: null,
    leaderboard: [],
    refreshLeaderboard: async () => undefined,
    submitFinalScore,
    completeRound,
  };
  return { ...base, ...overrides };
}

function Probe({
  integration,
  onValue,
}: {
  integration: WinkIntegration;
  onValue: (value: ReturnType<typeof useScoreData>) => void;
}) {
  onValue(useScoreData(integration));
  return null;
}

async function mountProbe(
  integration: WinkIntegration,
  onValue: (value: ReturnType<typeof useScoreData>) => void,
) {
  const container = document.createElement("div");
  const root: Root = createRoot(container);
  await act(async () => {
    root.render(<Probe integration={integration} onValue={onValue} />);
  });
  return {
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function gameResult(
  overrides: Partial<GameResult> & { roundId?: string; qualifies?: boolean } = {},
): GameResult & { roundId?: string; qualifies?: boolean } {
  return {
    score: 42,
    playTimeSec: 12,
    roundId: ROUND_ID,
    qualifies: true,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("useScoreData", () => {
  it("does not read local rows in Wink mode and maps remote entries", async () => {
    localStorage.setItem(
      "fruit-game-scores",
      JSON.stringify([
        {
          uid: "local-player",
          playerName: "Người chơi",
          photoURL: null,
          score: 9999,
          playTimeSec: 1,
          createdAt: Date.now(),
        },
      ]),
    );
    const integration = makeIntegration();
    let latest!: ReturnType<typeof useScoreData>;
    const mounted = await mountProbe(integration, (value) => {
      latest = value;
    });

    expect(latest.leaderboard).toEqual([]);
    expect(latest.bestScore).toBe(0);

    await act(async () => {
      await latest.refreshLeaderboard();
    });
    expect(latest.leaderboard).toEqual([
      {
        name: "Cao Thủ",
        score: 720,
        playTimeSec: 92,
        isLocal: false,
        rank: 1,
      },
      {
        name: "Anonymous player",
        score: 610,
        playTimeSec: 0,
        isLocal: false,
        rank: 2,
      },
    ]);
    expect(latest.leaderboard).not.toContainEqual(
      expect.objectContaining({ score: 9999 }),
    );
    await mounted.unmount();
  });

  it("keeps a remote empty leaderboard empty", async () => {
    const integration = makeIntegration({
      client: {
        ...makeIntegration().client!,
        getLeaderboard: vi.fn(async () => ({ entries: [], me: null })),
      },
    });
    let latest!: ReturnType<typeof useScoreData>;
    const mounted = await mountProbe(integration, (value) => {
      latest = value;
    });

    await act(async () => {
      await latest.refreshLeaderboard();
    });
    expect(latest.leaderboard).toEqual([]);
    expect(latest.personalBest).toBeNull();
    expect(latest.error).toBeNull();
    await mounted.unmount();
  });

  it("takes bestScore from the server's own-best, not from the page", async () => {
    // This player sits at rank 812, far outside the 30 rows the server returns,
    // so no amount of scanning `entries` could recover their best.
    const integration = makeIntegration({
      client: {
        ...makeIntegration().client!,
        getLeaderboard: vi.fn(async () => ({
          entries: REMOTE_ENTRIES,
          me: {
            rank: 812,
            score: 455,
            playTime: 61,
            displayName: "Người chơi",
            avatarUrl: null,
            createdAt: "2026-07-29T13:00:00.000Z",
          },
        })),
      },
    });
    let latest!: ReturnType<typeof useScoreData>;
    const mounted = await mountProbe(integration, (value) => {
      latest = value;
    });

    await act(async () => {
      await latest.refreshLeaderboard();
    });

    expect(latest.personalBest?.rank).toBe(812);
    expect(latest.bestScore).toBe(455);
    await mounted.unmount();
  });

  it("surfaces remote failure without creating a false local success", async () => {
    const integration = makeIntegration({
      client: {
        ...makeIntegration().client!,
        getLeaderboard: vi.fn(async () => {
          throw new Error("network failed");
        }),
      },
    });
    let latest!: ReturnType<typeof useScoreData>;
    const mounted = await mountProbe(integration, (value) => {
      latest = value;
    });

    let thrown: unknown;
    await act(async () => {
      try {
        await latest.refreshLeaderboard();
      } catch (value) {
        thrown = value;
      }
    });
    expect(thrown).toBeDefined();
    await act(async () => {});
    expect(latest.error).toMatchObject({ code: "API_NETWORK_ERROR" });
    expect(localStorage.getItem("fruit-game-scores")).toBeNull();
    await mounted.unmount();
  });

  it("does not create a local row when anonymous score submission is denied", async () => {
    const submitFinalScore = vi.fn(async () => {
      throw { code: "CAPABILITY_DENIED" };
    });
    const integration = makeIntegration({ submitFinalScore });
    let latest!: ReturnType<typeof useScoreData>;
    const mounted = await mountProbe(integration, (value) => {
      latest = value;
    });

    await act(async () => {
      await latest.onGameOver(gameResult());
    });
    expect(submitFinalScore).toHaveBeenCalledTimes(1);
    expect(latest.error).toMatchObject({ code: "CAPABILITY_DENIED" });
    expect(latest.scoreSubmissionError).toMatchObject({
      code: "CAPABILITY_DENIED",
    });
    expect(localStorage.getItem("fruit-game-scores")).toBeNull();
    expect(latest.lastScore).toBeNull();
    await mounted.unmount();
  });

  it("dismisses the blocked-score notice after four seconds", async () => {
    vi.useFakeTimers();
    try {
      const integration = makeIntegration({
        submitFinalScore: vi.fn(async () => {
          throw { code: "CAPABILITY_DENIED" };
        }),
      });
      let latest!: ReturnType<typeof useScoreData>;
      const mounted = await mountProbe(integration, (value) => {
        latest = value;
      });

      await act(async () => {
        await latest.onGameOver(gameResult());
      });
      expect(latest.scoreSubmissionError).toMatchObject({
        code: "CAPABILITY_DENIED",
      });

      await act(async () => {
        vi.advanceTimersByTime(4_000);
      });
      expect(latest.scoreSubmissionError).toBeNull();
      await mounted.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("submits one qualifying authenticated score without a local write", async () => {
    const submitFinalScore = vi.fn(async () => undefined);
    const integration = makeIntegration({
      phase: "ready_authenticated",
      capabilities: {
        getLeaderboard: true,
        submitScore: true,
        complete: true,
      },
      state: {
        ...READY_ANONYMOUS,
        phase: "ready_authenticated",
        identityType: "user",
        capabilities: {
          getLeaderboard: true,
          submitScore: true,
          complete: true,
        },
      },
      submitFinalScore,
    });
    let latest!: ReturnType<typeof useScoreData>;
    const mounted = await mountProbe(integration, (value) => {
      latest = value;
    });

    await act(async () => {
      await latest.onGameOver(gameResult({ score: 100 }));
    });
    expect(submitFinalScore).toHaveBeenCalledWith({
      roundId: ROUND_ID,
      score: 100,
      playTimeSec: 12,
      qualifies: true,
    });
    expect(submitFinalScore).toHaveBeenCalledTimes(1);
    expect(latest.lastScore).toBe(100);
    expect(localStorage.getItem("fruit-game-scores")).toBeNull();
    await mounted.unmount();
  });

  it("uses local storage only in explicit offline mode", async () => {
    const integration = makeIntegration({
      mode: "offline",
      phase: "ready_anonymous",
      capabilities: {
        getLeaderboard: false,
        submitScore: false,
        complete: false,
      },
      client: null,
    });
    let latest!: ReturnType<typeof useScoreData>;
    const mounted = await mountProbe(integration, (value) => {
      latest = value;
    });

    await act(async () => {
      await latest.onGameOver(gameResult({ score: 88 }));
    });
    expect(latest.leaderboard).toEqual([
      expect.objectContaining({
        name: "Người chơi",
        score: 88,
        isLocal: true,
      }),
    ]);
    expect(localStorage.getItem("fruit-game-scores")).toContain("88");
    await mounted.unmount();
  });
});
