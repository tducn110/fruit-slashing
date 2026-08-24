// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useWinkIntegration, isOfflineModeEnabled } from '../useWinkIntegration';
import type {
  RawWinkBridge,
  RawWinkBridgeState,
} from '../types';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

const ANONYMOUS_STATE: RawWinkBridgeState = {
  phase: 'ready_anonymous',
  gameId: '11111111-1111-4111-8111-111111111111',
  environment: 'dev',
  sessionId: '33333333-3333-4333-8333-333333333331',
  identityType: 'anonymous',
  capabilities: {
    getLeaderboard: true,
    submitScore: false,
    complete: true,
  },
  expiresAt: '2026-07-29T15:05:00.000Z',
  lifecycle: { paused: false, muted: false },
  error: null,
};

const AUTHENTICATED_STATE: RawWinkBridgeState = {
  ...ANONYMOUS_STATE,
  phase: 'ready_authenticated',
  sessionId: '33333333-3333-4333-8333-333333333333',
  identityType: 'user',
  capabilities: {
    getLeaderboard: true,
    submitScore: true,
    complete: true,
  },
};

function makeBridge(initialState = ANONYMOUS_STATE) {
  let state = initialState;
  let listener: ((next: RawWinkBridgeState) => void) | null = null;
  const unsubscribe = vi.fn(() => {
    listener = null;
  });
  const pauseListeners: Array<() => void> = [];
  const resumeListeners: Array<() => void> = [];
  const muteListeners: Array<() => void> = [];
  const unmuteListeners: Array<() => void> = [];

  const raw = {
    subscribe: vi.fn((next: (value: RawWinkBridgeState) => void) => {
      listener = next;
      next(state);
      return unsubscribe;
    }),
    getState: vi.fn(() => state),
    getCapabilities: vi.fn(() => state.capabilities),
    getLeaderboard: vi.fn(async () => ({ entries: [], total: 0 })),
    getPersonalBest: vi.fn(async () => ({ me: null })),
    submitScore: vi.fn(async () => ({
      entry: {
        id: '1',
        userId: null,
        isAnonymous: true,
        displayName: null,
        score: 1,
        playTime: null,
        gameMode: null,
        counter: null,
        metadata: null,
        rank: 1,
        createdAt: '2026-07-29T15:00:00.000Z',
        updatedAt: '2026-07-29T15:00:00.000Z',
      },
      isNewBest: true,
      previousBest: null,
    })),
    complete: vi.fn(),
    onPause: vi.fn((next: () => void) => {
      pauseListeners.push(next);
      return vi.fn();
    }),
    onResume: vi.fn((next: () => void) => {
      resumeListeners.push(next);
      return vi.fn();
    }),
    onMute: vi.fn((next: () => void) => {
      muteListeners.push(next);
      return vi.fn();
    }),
    onUnmute: vi.fn((next: () => void) => {
      unmuteListeners.push(next);
      return vi.fn();
    }),
    help: vi.fn(() => ({})),
  } as unknown as RawWinkBridge;

  return {
    raw,
    emit(next: RawWinkBridgeState) {
      state = next;
      listener?.(next);
    },
    pause: () => pauseListeners.forEach((next) => next()),
    resume: () => resumeListeners.forEach((next) => next()),
    mute: () => muteListeners.forEach((next) => next()),
    unmute: () => unmuteListeners.forEach((next) => next()),
  };
}

function Probe({ onValue }: { onValue: (value: ReturnType<typeof useWinkIntegration>) => void }) {
  onValue(useWinkIntegration());
  return null;
}

async function mountProbe(
  bridge: RawWinkBridge | null,
  onValue: (value: ReturnType<typeof useWinkIntegration>) => void,
) {
  if (bridge) {
    window.WinkBridge = bridge;
  } else {
    delete window.WinkBridge;
  }
  const container = document.createElement('div');
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
  delete window.WinkBridge;
});

it('subscribes once, projects identity/capabilities, and unregisters on unmount', async () => {
  const fixture = makeBridge();
  let latest!: ReturnType<typeof useWinkIntegration>;
  const mounted = await mountProbe(fixture.raw, (value) => {
    latest = value;
  });

  expect(fixture.raw.subscribe).toHaveBeenCalledTimes(1);
  expect(fixture.raw.onPause).toHaveBeenCalledTimes(1);
  expect(fixture.raw.onResume).toHaveBeenCalledTimes(1);
  expect(fixture.raw.onMute).toHaveBeenCalledTimes(1);
  expect(fixture.raw.onUnmute).toHaveBeenCalledTimes(1);
  expect(latest.phase).toBe('ready_anonymous');
  expect(latest.capabilities.submitScore).toBe(false);

  await act(async () => fixture.emit(AUTHENTICATED_STATE));
  expect(latest.phase).toBe('ready_authenticated');
  expect(latest.capabilities.submitScore).toBe(true);

  await mounted.unmount();
  const subscribeMock = fixture.raw.subscribe as unknown as {
    mock: { results: Array<{ value: unknown }> };
  };
  expect(subscribeMock.mock.results[0]?.value).toHaveBeenCalledTimes(1);
});

it('projects renewal/error states and parent lifecycle callbacks', async () => {
  const fixture = makeBridge();
  let latest!: ReturnType<typeof useWinkIntegration>;
  const mounted = await mountProbe(fixture.raw, (value) => {
    latest = value;
  });

  await act(async () =>
    fixture.emit({
      ...ANONYMOUS_STATE,
      phase: 'renewing',
    }),
  );
  expect(latest.phase).toBe('renewing');

  await act(async () =>
    fixture.emit({
      ...ANONYMOUS_STATE,
      phase: 'error',
      error: {
        code: 'PARENT_REQUIRED',
        message: 'Wink bridge requires an iframe parent',
        recoverable: false,
      },
    }),
  );
  expect(latest.error).toMatchObject({ code: 'PARENT_REQUIRED' });

  await act(async () => {
    fixture.pause();
    fixture.mute();
  });
  expect(latest.hostPaused).toBe(true);
  expect(latest.parentMuted).toBe(true);

  await act(async () => {
    fixture.resume();
    fixture.unmute();
  });
  expect(latest.hostPaused).toBe(false);
  expect(latest.parentMuted).toBe(false);

  await mounted.unmount();
});

it('fails visibly when the bridge is missing', async () => {
  let latest!: ReturnType<typeof useWinkIntegration>;
  const mounted = await mountProbe(null, (value) => {
    latest = value;
  });

  expect(latest.mode).toBe('wink');
  expect(latest.phase).toBe('error');
  expect(latest.error).toMatchObject({
    code: 'BRIDGE_MISSING',
    retryable: false,
  });
  await mounted.unmount();
});

it('allows offline mode only with the explicit development flag', () => {
  expect(isOfflineModeEnabled({ dev: true, flag: 'true' })).toBe(true);
  expect(isOfflineModeEnabled({ dev: false, flag: 'true' })).toBe(false);
  expect(isOfflineModeEnabled({ dev: true, flag: 'false' })).toBe(false);
  expect(isOfflineModeEnabled({ dev: true, flag: undefined })).toBe(false);
});
