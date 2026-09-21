import { useCallback, useEffect, useRef, useState } from "react";

import type {
  WinkCapability,
  WinkIntegration,
  WinkIntegrationError,
  WinkIntegrationErrorCode,
  WinkLeaderboardEntry,
  WinkMode,
  WinkPhase,
  WinkSDK,
  WinkStatus,
  WinkSubmitScoreResult,
} from "./types";

const SAFE_ERROR_MESSAGES: Record<WinkIntegrationErrorCode, string> = {
  PARENT_REQUIRED: "Mini-game phải được mở trong iframe Wink.",
  CAPABILITY_DENIED: "Thao tác này không được cấp quyền cho phiên hiện tại.",
  API_NETWORK_ERROR: "Không thể kết nối dịch vụ Wink.",
  INVALID_SCORE: "Điểm số cuối không hợp lệ.",
};

function safeError(
  code: WinkIntegrationErrorCode,
  retryable = false,
): WinkIntegrationError {
  return Object.freeze({
    code,
    message: SAFE_ERROR_MESSAGES[code] || "Lỗi kết nối Wink.",
    retryable,
  });
}

function normalizeLocale(value?: string): "vi" | "en" {
  const locale = value?.split("-")[0];
  return locale === "vi" || locale === "en" ? locale : "en";
}

// Global bootstrap promise so multiple hook instances share the same initialization
let globalInitPromise: Promise<WinkSDK | null> | null = null;
let globalReadyPromise: Promise<void> | null = null;
let boundWinkInstance: unknown = undefined;

export function resetGlobalWinkInit(): void {
  globalInitPromise = null;
  globalReadyPromise = null;
  boundWinkInstance = undefined;
}

export function resolveGlobalWink(): Promise<WinkSDK | null> {
  const currentWink = typeof window !== "undefined" ? window.Wink : undefined;
  if (!globalInitPromise || boundWinkInstance !== currentWink) {
    boundWinkInstance = currentWink;
    globalInitPromise = Promise.resolve()
      .then(() => (typeof window !== "undefined" && window.Wink?.init ? window.Wink.init() : undefined))
      .then((sdk) => sdk || window.Wink || null)
      .catch(() => window.Wink || null);
    globalReadyPromise = globalInitPromise.then(() => undefined).catch(() => undefined);
  }
  return globalInitPromise;
}



export function useWinkIntegration(): WinkIntegration {
  const initPromise = resolveGlobalWink();
  
  const [sdk, setSdk] = useState<WinkSDK | null>(null);
  const [status, setStatus] = useState<WinkStatus>("connecting");
  const [isReady, setIsReady] = useState(false);
  const [hostPaused, setHostPaused] = useState(false);
  const [parentMuted, setParentMuted] = useState(sdk?.muted ?? false);
  const [locale, setLocale] = useState(normalizeLocale(sdk?.locale));
  const [error, setError] = useState<WinkIntegrationError | null>(null);
  const [personalBest, setPersonalBest] = useState<WinkLeaderboardEntry | null>(null);
  const [leaderboard, setLeaderboard] = useState<readonly WinkLeaderboardEntry[]>([]);

  const sdkRef = useRef<WinkSDK | null>(sdk);
  sdkRef.current = sdk;

  useEffect(() => {
    let unmounted = false;
    const cleanups: Array<() => void> = [];

    void resolveGlobalWink().then((resolvedSdk) => {
      if (unmounted) return;
      if (resolvedSdk) {
        setSdk(resolvedSdk);
        setStatus(resolvedSdk.status);
        setParentMuted(resolvedSdk.muted);
        const initialLocale = normalizeLocale(resolvedSdk.locale);
        setLocale(initialLocale);

        try {
          cleanups.push(
            resolvedSdk.on("pause", () => {
              setHostPaused(true);
            }),
          );
          cleanups.push(
            resolvedSdk.on("resume", () => {
              setHostPaused(false);
            }),
          );
          cleanups.push(
            resolvedSdk.on("mute", () => {
              setParentMuted(true);
            }),
          );
          cleanups.push(
            resolvedSdk.on("unmute", () => {
              setParentMuted(false);
            }),
          );
          cleanups.push(
            resolvedSdk.on("locale", (nextLocale: string) => {
              // Only track host locale as React state.
              // Do NOT auto-switch i18n language — game defaults to English
              // and the user switches language manually via settings.
              const normalizedLocale = normalizeLocale(nextLocale);
              setLocale(normalizedLocale);
            }),
          );
        } catch (e) {
          console.warn("[WinkIntegration] Error subscribing to SDK events", e);
        }

        // ponytail: fetch personal best on boot so menu displays authenticated high score immediately
        if (resolvedSdk.can("submitScore")) {
          void resolvedSdk
            .getPersonalBest()
            .then((result) => {
              if (!unmounted && result?.me) setPersonalBest(result.me);
            })
            .catch(() => undefined);
        }
      } else {
        setStatus("standalone");
      }
      setIsReady(true);
    });

    return () => {
      unmounted = true;
      cleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch {}
      });
    };
  }, []);

  const can = useCallback(
    (capability: WinkCapability): boolean => {
      return sdkRef.current?.can(capability) ?? false;
    },
    [],
  );

  const gameplayStart = useCallback(() => {
    try {
      sdkRef.current?.gameplayStart();
    } catch (e) {
      console.warn("[WinkIntegration] gameplayStart error", e);
    }
  }, []);

  const gameplayStop = useCallback(() => {
    try {
      sdkRef.current?.gameplayStop();
    } catch (e) {
      console.warn("[WinkIntegration] gameplayStop error", e);
    }
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    const currentSdk = sdkRef.current;
    if (!currentSdk) {
      setLeaderboard([]);
      setPersonalBest(null);
      return;
    }

    if (!currentSdk.can("getLeaderboard")) {
      setLeaderboard([]);
      setPersonalBest(null);
      return;
    }

    try {
      const board = await currentSdk.getLeaderboard({ limit: 30 });
      setLeaderboard(board.entries || []);
      setError(null);
    } catch (err: any) {
      console.warn("[WinkIntegration] getLeaderboard error", err);
      setError(safeError("API_NETWORK_ERROR", true));
      setLeaderboard([]);
    }
  }, []);

  const refreshPersonalBest = useCallback(async () => {
    const currentSdk = sdkRef.current;
    if (!currentSdk) {
      setPersonalBest(null);
      return;
    }

    try {
      const result = await currentSdk.getPersonalBest();
      if (result?.me) setPersonalBest(result.me);
    } catch {
      // Ignored non-fatal in standalone or network glitch
    }
  }, []);

  const submitFinalScore = useCallback(
    async (input: {
      roundId?: string;
      score: number;
      playTimeSec?: number;
      qualifies?: boolean;
      metadata?: Record<string, unknown>;
    }): Promise<WinkSubmitScoreResult | null> => {
      const currentSdk = sdkRef.current;
      if (input.qualifies === false) return null;
      if (!currentSdk) return null;

      if (!currentSdk.can("submitScore")) {
        const denied = safeError("CAPABILITY_DENIED");
        setError(denied);
        return null;
      }

      try {
        const response = await currentSdk.submitScore({
          score: input.score,
          playTime: input.playTimeSec ?? 0,
          metadata: {
            roundId: input.roundId,
            ...input.metadata,
          },
        });
        if (response?.entry) {
          setPersonalBest(response.entry);
        }
        setError(null);
        return {
          entry: response?.entry ?? null,
          isNewBest: Boolean(response?.isNewBest),
          previousBest: response?.previousBest ?? null,
        };
      } catch (err: any) {
        console.warn("[WinkIntegration] submitScore error", err);
        const netErr = safeError("API_NETWORK_ERROR", true);
        setError(netErr);
        return null;
      }
    },
    [],
  );

  const mode: WinkMode = status === "standalone" ? "offline" : "wink";
  const phase: WinkPhase =
    status === "connecting"
      ? "booting"
      : status === "online"
        ? sdk?.player?.isGuest
          ? "ready_anonymous"
          : "ready_authenticated"
        : status === "connected"
          ? "ready_anonymous"
          : "ready_anonymous";

  const bestScore = personalBest?.score ?? 0;
  const playerEntry = personalBest;
  const displayName = sdk?.player?.displayName ?? null;
  const canSubmitScore = can("submitScore");

  return {
    status,
    isReady,
    readyPromise: initPromise,
    sdk,
    mode,
    phase,
    hostPaused,
    parentMuted,
    locale,
    error,
    leaderboard,
    personalBest,
    playerEntry,
    displayName,
    bestScore,
    canSubmitScore,
    can,
    gameplayStart,
    gameplayStop,
    refreshLeaderboard,
    refreshPersonalBest,
    fetchPersonalBest: refreshPersonalBest,
    submitFinalScore,
  };
}
