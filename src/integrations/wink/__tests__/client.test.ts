import { describe, expect, it, vi } from 'vitest';
import {
  WinkGameClientError,
  createWinkGameClient,
} from '../client';
import type {
  RawWinkBridge,
  RawWinkBridgeState,
} from '../types';

const ROUND_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROUND_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function rawState(
  overrides: Partial<RawWinkBridgeState> = {},
): RawWinkBridgeState {
  return {
    phase: 'ready_authenticated',
    gameId: '11111111-1111-4111-8111-111111111111',
    environment: 'dev',
    sessionId: '33333333-3333-4333-8333-333333333333',
    identityType: 'user',
    capabilities: {
      getLeaderboard: true,
      submitScore: true,
      complete: true,
    },
    expiresAt: '2026-07-29T15:05:00.000Z',
    lifecycle: { paused: false, muted: false },
    error: null,
    ...overrides,
  };
}

function rawEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: '12',
    userId: '44444444-4444-4444-8444-444444444444',
    isAnonymous: false,
    displayName: 'Winkgames Pilot User',
    score: 321,
    playTime: 18,
    gameMode: 'classic',
    counter: 2,
    metadata: { roundId: ROUND_A },
    rank: 1,
    createdAt: '2026-07-29T15:00:00.000Z',
    updatedAt: '2026-07-29T15:00:00.000Z',
    ...overrides,
  };
}

function bridge(
  overrides: Partial<RawWinkBridge> = {},
): RawWinkBridge {
  const state = rawState();
  return {
    subscribe: vi.fn((listener) => {
      listener(state);
      return vi.fn();
    }),
    getState: vi.fn(() => state),
    getCapabilities: vi.fn(() => state.capabilities),
    getLeaderboard: vi.fn(async () => ({
      entries: [rawEntry()],
      total: 1,
    })),
    submitScore: vi.fn(async () => ({
      entry: rawEntry(),
      isNewBest: true,
      previousBest: null,
    })),
    complete: vi.fn(),
    onPause: vi.fn(() => vi.fn()),
    onResume: vi.fn(() => vi.fn()),
    onMute: vi.fn(() => vi.fn()),
    onUnmute: vi.fn(() => vi.fn()),
    help: vi.fn(() => ({
      bridgeVersion: '9.0.1',
      protocolVersion: 1,
      phase: state.phase,
      gameId: state.gameId,
      environment: state.environment,
      hasSession: true,
      capabilities: state.capabilities,
      lifecycle: state.lifecycle,
      errorCode: null,
    })),
    ...overrides,
  };
}

describe('createWinkGameClient', () => {
  it('projects ready state and capabilities without raw authority fields', () => {
    const source = rawState() as RawWinkBridgeState & {
      accessToken: string;
      apiBase: string;
      anonymousId: string;
    };
    source.accessToken = 'scoped-secret';
    source.apiBase = 'https://api.example.test';
    source.anonymousId = '22222222-2222-4222-8222-222222222222';
    const client = createWinkGameClient(
      bridge({
        getState: vi.fn(() => source),
        getCapabilities: vi.fn(() => source.capabilities),
      }),
    );

    expect(client.getState()).toEqual(rawState());
    expect(client.getCapabilities()).toEqual({
      getLeaderboard: true,
      submitScore: true,
      complete: true,
    });
    expect(JSON.stringify(client.getState())).not.toMatch(
      /scoped-secret|api\.example|22222222/,
    );
  });

  it('maps the exact R1 leaderboard response to the UI-safe shape', async () => {
    const client = createWinkGameClient(bridge());

    await expect(
      client.getLeaderboard({ limit: 10, offset: 0 }),
    ).resolves.toEqual([
      {
        rank: 1,
        score: 321,
        playTime: 18,
        displayName: 'Winkgames Pilot User',
        avatarUrl: null,
        createdAt: '2026-07-29T15:00:00.000Z',
      },
    ]);
  });

  it.each([
    [{ score: Number.NaN, metadata: { roundId: ROUND_A } }, 'INVALID_SCORE'],
    [{ score: -1, metadata: { roundId: ROUND_A } }, 'INVALID_SCORE'],
    [{ score: 1.5, metadata: { roundId: ROUND_A } }, 'INVALID_SCORE'],
    [
      { score: 1, playTime: 86_401, metadata: { roundId: ROUND_A } },
      'INVALID_SCORE',
    ],
    [{ score: 1, metadata: { roundId: 'not-a-uuid' } }, 'INVALID_ROUND'],
  ])('rejects invalid score input %# before the bridge', async (input, code) => {
    const raw = bridge();
    const client = createWinkGameClient(raw);

    await expect(client.submitScore(input)).rejects.toMatchObject({ code });
    expect(raw.submitScore).not.toHaveBeenCalled();
  });

  it('maps anonymous denial and still permits independent completion', async () => {
    const raw = bridge({
      submitScore: vi.fn().mockRejectedValue({
        code: 'CAPABILITY_DENIED',
        message: 'Capability is not available',
        recoverable: false,
      }),
    });
    const client = createWinkGameClient(raw);

    await expect(
      client.submitScore({
        score: 50,
        metadata: { roundId: ROUND_A },
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'CAPABILITY_DENIED',
        retryable: false,
      }),
    );
    await expect(
      client.complete({ roundId: ROUND_A, playDurationMs: 5_000 }),
    ).resolves.toBeUndefined();
    expect(raw.complete).toHaveBeenCalledTimes(1);
  });

  it('memoizes score and completion promises separately per round', async () => {
    let resolveScore!: (value: unknown) => void;
    const scoreResult = new Promise((resolve) => {
      resolveScore = resolve;
    });
    const raw = bridge({
      submitScore: vi.fn(() => scoreResult),
    });
    const client = createWinkGameClient(raw);
    const scoreInput = {
      score: 99,
      metadata: { roundId: ROUND_A },
    };

    const firstScore = client.submitScore(scoreInput);
    const duplicateScore = client.submitScore(scoreInput);
    const firstComplete = client.complete({
      roundId: ROUND_A,
      playDurationMs: 10_000,
    });
    const duplicateComplete = client.complete({
      roundId: ROUND_A,
      playDurationMs: 10_000,
    });

    expect(duplicateScore).toBe(firstScore);
    expect(duplicateComplete).toBe(firstComplete);
    expect(raw.submitScore).toHaveBeenCalledTimes(1);
    expect(raw.complete).toHaveBeenCalledTimes(1);

    resolveScore({
      entry: rawEntry(),
      isNewBest: true,
      previousBest: null,
    });
    await expect(firstScore).resolves.toBeUndefined();
    await expect(firstComplete).resolves.toBeUndefined();

    await client.submitScore({
      score: 100,
      metadata: { roundId: ROUND_B },
    });
    await client.complete({ roundId: ROUND_B });
    expect(raw.submitScore).toHaveBeenCalledTimes(2);
    expect(raw.complete).toHaveBeenCalledTimes(2);
  });

  it('memoizes completion failure without coupling it to score', async () => {
    const raw = bridge({
      complete: vi.fn(() => {
        throw {
          code: 'MESSAGE_REJECTED',
          message: 'Message rejected',
          recoverable: true,
        };
      }),
    });
    const client = createWinkGameClient(raw);
    const completion = client.complete({ roundId: ROUND_A });

    await expect(completion).rejects.toMatchObject({
      code: 'MESSAGE_REJECTED',
      retryable: true,
    });
    await expect(
      client.submitScore({
        score: 1,
        metadata: { roundId: ROUND_A },
      }),
    ).resolves.toBeUndefined();
    expect(raw.complete).toHaveBeenCalledTimes(1);
    expect(raw.submitScore).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      getLeaderboard: vi.fn(async () => ({
        entries: [rawEntry({ displayName: 123 })],
        total: 1,
      })),
    },
    {
      getLeaderboard: vi.fn(async () => ({
        entries: [],
        total: -1,
      })),
    },
  ])('rejects malformed leaderboard output', async (overrides) => {
    const client = createWinkGameClient(bridge(overrides));

    await expect(client.getLeaderboard()).rejects.toMatchObject({
      code: 'API_NETWORK_ERROR',
      retryable: true,
    });
  });

  it('fails visibly when the canonical bridge is missing', () => {
    expect(() => createWinkGameClient(null)).toThrow(
      expect.objectContaining({
        code: 'BRIDGE_MISSING',
        retryable: false,
      }),
    );
    expect(() => createWinkGameClient(null)).toThrow(WinkGameClientError);
  });
});
