import { useCallback, useEffect, useRef, useState } from "react";
import {
  createWinkGameClient,
  getInstalledWinkBridge,
  WinkGameClientError,
} from "./client";
import type {
  RedactedWinkState,
  WinkCapabilities,
  WinkIntegration,
  WinkIntegrationError,
  WinkIntegrationErrorCode,
  WinkLeaderboardEntry,
  WinkGameClient,
} from "./types";

const EMPTY_CAPABILITIES: WinkCapabilities = Object.freeze({
  getLeaderboard: false,
  submitScore: false,
  complete: false,
});

const OFFLINE_STATE: RedactedWinkState = Object.freeze({
  phase: "ready_anonymous",
  gameId: null,
  environment: "dev",
  sessionId: null,
  identityType: "anonymous",
  capabilities: EMPTY_CAPABILITIES,
  expiresAt: null,
  lifecycle: Object.freeze({ paused: false, muted: false }),
  error: null,
});

const SAFE_ERROR_MESSAGES: Record<WinkIntegrationErrorCode, string> = {
  PARENT_REQUIRED: "Mini-game phải được mở trong iframe Wink.",
  BRIDGE_READY_TIMEOUT: "Không thể khởi tạo kết nối với Wink.",
  PROTOCOL_MISMATCH: "Phiên bản giao thức Wink không tương thích.",
  RUNTIME_CONFIG_INVALID: "Cấu hình mini-game không hợp lệ.",
  SESSION_CREATE_FAILED: "Không thể tạo phiên chơi.",
  SESSION_RENEWAL_FAILED: "Không thể gia hạn phiên chơi.",
  SESSION_EXPIRED: "Phiên chơi đã hết hạn.",
  CAPABILITY_DENIED: "Thao tác này không được cấp quyền cho phiên hiện tại.",
  API_NETWORK_ERROR: "Không thể kết nối dịch vụ Wink.",
  MESSAGE_REJECTED: "Thông điệp từ Wink không hợp lệ.",
  BRIDGE_MISSING: "Wink bridge chưa được cài đặt.",
  INVALID_SCORE: "Điểm số cuối không hợp lệ.",
  INVALID_ROUND: "Mã vòng chơi không hợp lệ.",
};

export function isOfflineModeEnabled(input: {
  dev: boolean;
  flag: string | undefined;
}): boolean {
  return input.dev === true && input.flag === "true";
}

function safeError(
  value: unknown,
  fallbackCode: WinkIntegrationErrorCode = "API_NETWORK_ERROR",
): WinkIntegrationError {
  const candidateCode =
    value instanceof WinkGameClientError
      ? value.code
      : typeof value === "object" &&
          value !== null &&
          "code" in value
        ? (value as { code?: unknown }).code
        : value;
  const code = isIntegrationErrorCode(candidateCode)
    ? candidateCode
    : fallbackCode;
  const retryable =
    value instanceof WinkGameClientError
      ? value.retryable
      : code === "API_NETWORK_ERROR" || code === "BRIDGE_READY_TIMEOUT";
  return Object.freeze({
    code,
    retryable,
    message: SAFE_ERROR_MESSAGES[code],
  });
}

function isIntegrationErrorCode(value: unknown): value is WinkIntegrationErrorCode {
  return (
    typeof value === "string" &&
    Object.hasOwn(SAFE_ERROR_MESSAGES, value)
  );
}

function stateWithError(
  state: RedactedWinkState,
  error: WinkIntegrationError | null,
): RedactedWinkState {
  return Object.freeze({
    ...state,
    error,
    lifecycle: Object.freeze({ ...state.lifecycle }),
    capabilities: Object.freeze({ ...state.capabilities }),
  });
}

function stateWithLifecycle(
  state: RedactedWinkState,
  lifecycle: Partial<RedactedWinkState["lifecycle"]>,
): RedactedWinkState {
  return stateWithError(
    {
      ...state,
      lifecycle: Object.freeze({ ...state.lifecycle, ...lifecycle }),
    },
    errorFromState(state),
  );
}

function initialConnection(): {
  client: WinkGameClient | null;
  state: RedactedWinkState;
  error: WinkIntegrationError | null;
} {
  const bridge = getInstalledWinkBridge();
  if (!bridge) {
    const error = safeError(undefined, "BRIDGE_MISSING");
    return {
      client: null,
      state: stateWithError(
        Object.freeze({
          phase: "error",
          gameId: null,
          environment: null,
          sessionId: null,
          identityType: null,
          capabilities: EMPTY_CAPABILITIES,
          expiresAt: null,
          lifecycle: Object.freeze({ paused: false, muted: false }),
          error: null,
        }),
        error,
      ),
      error,
    };
  }

  try {
    const client = createWinkGameClient(bridge);
    const state = client.getState();
    return { client, state, error: state.error };
  } catch (value) {
    const error = safeError(value, "MESSAGE_REJECTED");
    return {
      client: null,
      state: stateWithError(
        Object.freeze({
          phase: "error",
          gameId: null,
          environment: null,
          sessionId: null,
          identityType: null,
          capabilities: EMPTY_CAPABILITIES,
          expiresAt: null,
          lifecycle: Object.freeze({ paused: false, muted: false }),
          error: null,
        }),
        error,
      ),
      error,
    };
  }
}

function readBuildFlag(): boolean {
  return isOfflineModeEnabled({
    dev: import.meta.env.DEV === true,
    flag: import.meta.env.VITE_WINK_OFFLINE_MODE,
  });
}

export function useWinkIntegration(): WinkIntegration {
  const offline = readBuildFlag();
  const connectionRef = useRef<{
    initialized: boolean;
    client: WinkGameClient | null;
    state: RedactedWinkState;
    error: WinkIntegrationError | null;
  }>({
    initialized: false,
    client: null,
    state: OFFLINE_STATE,
    error: null,
  });

  if (!connectionRef.current.initialized) {
    connectionRef.current.initialized = true;
    if (!offline) {
      const connection = initialConnection();
      connectionRef.current.client = connection.client;
      connectionRef.current.state = connection.state;
      connectionRef.current.error = connection.error;
    }
  }

  const connection = connectionRef.current;
  const [state, setState] = useState<RedactedWinkState>(connection.state);
  const [error, setError] = useState<WinkIntegrationError | null>(
    connection.error,
  );
  const [hostPaused, setHostPaused] = useState(
    connection.state.lifecycle.paused,
  );
  const [parentMuted, setParentMuted] = useState(
    connection.state.lifecycle.muted,
  );
  const [leaderboard, setLeaderboard] = useState<
    readonly WinkLeaderboardEntry[]
  >([]);
  const [personalBest, setPersonalBest] =
    useState<WinkLeaderboardEntry | null>(null);

  useEffect(() => {
    const client = connection.client;
    if (!client) return;

    const applyState = (next: RedactedWinkState) => {
      const projectedError = next.error ? safeError(next.error) : null;
      setState(stateWithError(next, projectedError));
      setError(projectedError);
      setHostPaused(next.lifecycle.paused);
      setParentMuted(next.lifecycle.muted);
    };

    const cleanups: Array<() => void> = [];
    try {
      cleanups.push(client.subscribe(applyState));
      cleanups.push(
        client.onPause(() => {
          setHostPaused(true);
          setState((current) => stateWithLifecycle(current, { paused: true }));
        }),
      );
      cleanups.push(
        client.onResume(() => {
          setHostPaused(false);
          setState((current) => stateWithLifecycle(current, { paused: false }));
        }),
      );
      cleanups.push(
        client.onMute(() => {
          setParentMuted(true);
          setState((current) => stateWithLifecycle(current, { muted: true }));
        }),
      );
      cleanups.push(
        client.onUnmute(() => {
          setParentMuted(false);
          setState((current) => stateWithLifecycle(current, { muted: false }));
        }),
      );
    } catch (value) {
      const nextError = safeError(value, "MESSAGE_REJECTED");
      setError(nextError);
      setState((current) => stateWithError(current, nextError));
      cleanups.splice(0).forEach((cleanup) => cleanup());
    }

    return () => {
      cleanups.splice(0).forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          // Cleanup must not turn a normal React unmount into an integration error.
        }
      });
    };
  }, [connection]);

  const recordError = useCallback((value: unknown, fallback?: WinkIntegrationErrorCode) => {
    const nextError = safeError(value, fallback);
    setError(nextError);
    setState((current) => stateWithError(current, nextError));
    return nextError;
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    if (offline) {
      setLeaderboard([]);
      setPersonalBest(null);
      return;
    }
    if (!connection.client) {
      throw recordError(undefined, "BRIDGE_MISSING");
    }
    if (!state.capabilities.getLeaderboard) {
      throw recordError(undefined, "CAPABILITY_DENIED");
    }
    try {
      // The server caps a page at 30; this game asks for the 10 it displays.
      // `me` comes back regardless of the page size, which is the point of it.
      const board = await connection.client.getLeaderboard({ limit: 10 });
      setLeaderboard(board.entries);
      setPersonalBest(board.me);
      setError(null);
      setState((current) => stateWithError(current, null));
    } catch (value) {
      throw recordError(value);
    }
  }, [connection, offline, recordError, state.capabilities.getLeaderboard]);

  const submitFinalScore = useCallback(
    async (input: {
      roundId: string;
      score: number;
      playTimeSec: number;
      qualifies: boolean;
    }) => {
      if (!input.qualifies || offline) return;
      if (!connection.client) {
        throw recordError(undefined, "BRIDGE_MISSING");
      }
      if (!state.capabilities.submitScore) {
        throw recordError(undefined, "CAPABILITY_DENIED");
      }
      try {
        await connection.client.submitScore({
          score: input.score,
          playTime: input.playTimeSec,
          metadata: { roundId: input.roundId },
        });
        setError(null);
        setState((current) => stateWithError(current, null));
      } catch (value) {
        throw recordError(value);
      }
    },
    [connection, offline, recordError, state.capabilities.submitScore],
  );

  const completeRound = useCallback(
    async (input: { roundId: string; playDurationMs: number }) => {
      if (offline) return;
      if (!connection.client) {
        throw recordError(undefined, "BRIDGE_MISSING");
      }
      if (!state.capabilities.complete) {
        throw recordError(undefined, "CAPABILITY_DENIED");
      }
      try {
        await connection.client.complete(input);
        setError(null);
        setState((current) => stateWithError(current, null));
      } catch (value) {
        throw recordError(value);
      }
    },
    [connection, offline, recordError, state.capabilities.complete],
  );

  const projectedState = stateWithError(state, error);
  return {
    mode: offline ? "offline" : "wink",
    phase: projectedState.phase,
    capabilities: projectedState.capabilities,
    state: projectedState,
    client: connection.client,
    hostPaused,
    parentMuted,
    error,
    leaderboard,
    personalBest,
    refreshLeaderboard,
    submitFinalScore,
    completeRound,
  };
}

function errorFromState(state: RedactedWinkState): WinkIntegrationError | null {
  return state.error ? safeError(state.error) : null;
}
