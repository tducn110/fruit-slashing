// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWinkIntegration, resetGlobalWinkInit } from '../useWinkIntegration';
import type { WinkIntegration, WinkSDK } from '../types';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function mountHook(): {
  getLatest: () => WinkIntegration;
  unmount: () => void;
} {
  let latest!: WinkIntegration;
  function Probe() {
    latest = useWinkIntegration();
    return null;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);

  act(() => {
    root.render(<Probe />);
  });

  return {
    getLatest: () => latest,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('useWinkIntegration (Wink SDK v1 Contract)', () => {
  let originalWink: unknown;

  beforeEach(() => {
    resetGlobalWinkInit();
    originalWink = window.Wink;
  });

  afterEach(() => {
    resetGlobalWinkInit();
    window.Wink = originalWink as WinkSDK;
  });

  it('runs safely in standalone mode when SDK is absent or offline', async () => {
    delete (window as any).Wink;
    const { getLatest, unmount } = mountHook();

    expect(getLatest().status).toBe('connecting');

    // Wait for readiness
    await act(async () => {
      await getLatest().readyPromise;
    });

    expect(getLatest().isReady).toBe(true);
    expect(getLatest().status).toBe('standalone');
    expect(getLatest().can('submitScore')).toBe(false);
    expect(getLatest().leaderboard).toEqual([]);

    unmount();
  });

  it('connects to window.Wink SDK v1 and binds lifecycle events', async () => {
    const listeners: Record<string, Function[]> = {
      pause: [],
      resume: [],
      mute: [],
      unmute: [],
      locale: [],
    };

    const mockSdk: WinkSDK = {
      init: vi.fn(async () => mockSdk),
      gameplayStart: vi.fn(),
      gameplayStop: vi.fn(),
      submitScore: vi.fn(async () => ({ entry: null, isNewBest: true, previousBest: null })),
      getLeaderboard: vi.fn(async () => ({
        entries: [{ rank: 1, score: 100, playTime: 30, displayName: 'Test User', avatarUrl: null }],
        me: null,
        total: 1,
      })),
      getPersonalBest: vi.fn(async () => ({ me: null })),
      track: vi.fn(async () => {}),
      on: vi.fn((event, cb) => {
        listeners[event]?.push(cb);
        return () => {
          listeners[event] = listeners[event]?.filter((l) => l !== cb);
        };
      }),
      can: vi.fn((cap) => cap === 'submitScore' || cap === 'getLeaderboard'),
      player: { isGuest: false, displayName: 'Wink Player', avatarUrl: null },
      locale: 'vi',
      muted: false,
      status: 'online',
      version: '1.0.0',
      protocolVersion: 1,
      destroy: vi.fn(),
    };

    window.Wink = mockSdk;

    const { getLatest, unmount } = mountHook();

    await act(async () => {
      await getLatest().readyPromise;
    });

    expect(mockSdk.init).toHaveBeenCalled();
    expect(getLatest().status).toBe('online');
    expect(getLatest().can('submitScore')).toBe(true);
    expect(getLatest().can('complete')).toBe(false);

    // Test host mute event
    expect(getLatest().parentMuted).toBe(false);
    act(() => {
      listeners.mute.forEach((cb) => cb());
    });
    expect(getLatest().parentMuted).toBe(true);

    // Test host pause event
    expect(getLatest().hostPaused).toBe(false);
    act(() => {
      listeners.pause.forEach((cb) => cb());
    });
    expect(getLatest().hostPaused).toBe(true);

    // Test gameplayStart & gameplayStop
    act(() => {
      getLatest().gameplayStart();
      getLatest().gameplayStop();
    });
    expect(mockSdk.gameplayStart).toHaveBeenCalledTimes(1);
    expect(mockSdk.gameplayStop).toHaveBeenCalledTimes(1);

    // Test custom tracking
    act(() => {
      getLatest().track("custom_event", { foo: "bar" });
    });
    expect(mockSdk.track).not.toHaveBeenCalled(); // can('track') was not mocked as true

    // Now enable can('track')
    (mockSdk.can as any).mockImplementation((cap: string) => cap === "track" || cap === "submitScore");
    act(() => {
      getLatest().track("custom_event", { foo: "bar" });
    });
    expect(mockSdk.track).toHaveBeenCalledWith("custom_event", { foo: "bar" });

    // Test Wink Dev Kit standard properties
    expect(getLatest().mode).toBe("wink");
    expect(getLatest().phase).toBe("ready_authenticated");
    expect(getLatest().displayName).toBe("Wink Player");
    expect(getLatest().canSubmitScore).toBe(true);
    expect(getLatest().bestScore).toBe(0);

    // Test submitFinalScore return value and bestScore update
    const mockBestEntry = {
      rank: 1,
      score: 250,
      playTime: 45,
      displayName: "Wink Player",
      avatarUrl: null,
    };
    (mockSdk.submitScore as any).mockResolvedValueOnce({
      entry: mockBestEntry,
      isNewBest: true,
      previousBest: 0,
    });

    let submitResult: any;
    await act(async () => {
      submitResult = await getLatest().submitFinalScore({
        score: 250,
        playTimeSec: 45,
        roundId: "test-round-1",
      });
    });

    expect(submitResult).toEqual({
      entry: mockBestEntry,
      isNewBest: true,
      previousBest: 0,
    });
    expect(getLatest().personalBest).toEqual(mockBestEntry);
    expect(getLatest().playerEntry).toEqual(mockBestEntry);
    expect(getLatest().bestScore).toBe(250);

    unmount();
  });
});
