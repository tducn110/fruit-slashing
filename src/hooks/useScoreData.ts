import { useCallback, useEffect, useState } from "react";
import type { GameResult } from "../game/types";
import {
  getLocalScores,
  saveLocalScore,
  type LeaderboardEntry,
} from "../lib/localScores";
import type {
  WinkIntegration,
  WinkIntegrationError,
  WinkIntegrationErrorCode,
  WinkLeaderboardEntry,
} from "../integrations/wink/types";
import { WinkGameClientError } from "../integrations/wink/client";

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

const SCORE_BLOCKED_NOTICE_MS = 4_000;

type GameResultWithRound = GameResult & {
  roundId?: string;
  qualifies?: boolean;
};

function isErrorCode(value: unknown): value is WinkIntegrationErrorCode {
  return typeof value === "string" && Object.hasOwn(SAFE_ERROR_MESSAGES, value);
}

function visibleError(
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
  const code = isErrorCode(candidateCode) ? candidateCode : fallbackCode;
  const retryable =
    value instanceof WinkGameClientError
      ? value.retryable
      : code === "API_NETWORK_ERROR" || code === "BRIDGE_READY_TIMEOUT";
  return Object.freeze({
    code,
    message: SAFE_ERROR_MESSAGES[code],
    retryable,
  });
}

function readOfflineScores(): LeaderboardEntry[] {
  return getLocalScores()
    .slice(0, 100)
    .map((score) => ({
      name: score.playerName,
      score: score.score,
      playTimeSec: score.playTimeSec,
      isLocal: true,
    }));
}

function mapRemoteScores(
  entries: readonly {
    rank: number;
    score: number;
    playTime: number | null;
    displayName: string | null;
  }[],
): LeaderboardEntry[] {
  return entries.map((entry) => ({
    name: entry.displayName ?? "Anonymous player",
    score: entry.score,
    playTimeSec: entry.playTime ?? 0,
    isLocal: false,
    rank: entry.rank,
  }));
}

function bestLocalScore(scores: readonly LeaderboardEntry[]): number {
  return scores.reduce(
    (best, entry) => (entry.score > best ? entry.score : best),
    0,
  );
}

export function useScoreData(integration: WinkIntegration) {
  const offline = integration.mode === "offline";
  const [scores, setScores] = useState<LeaderboardEntry[]>(() =>
    offline ? readOfflineScores() : [],
  );
  const [lastScore, setLastScore] = useState<number | null>(() =>
    offline ? bestLocalScore(readOfflineScores()) || null : null,
  );
  const [error, setError] = useState<WinkIntegrationError | null>(
    integration.error,
  );
  const [scoreSubmissionError, setScoreSubmissionError] =
    useState<WinkIntegrationError | null>(null);
  const [personalBest, setPersonalBest] =
    useState<WinkLeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (integration.error) setError(integration.error);
  }, [integration.error]);

  useEffect(() => {
    if (!scoreSubmissionError) return;
    const timeoutId = window.setTimeout(
      () => setScoreSubmissionError(null),
      SCORE_BLOCKED_NOTICE_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [scoreSubmissionError]);

  const refreshLeaderboard = useCallback(async () => {
    if (offline) {
      setScores(readOfflineScores());
      setPersonalBest(null);
      setError(null);
      return;
    }

    if (!integration.client) {
      const nextError = visibleError(undefined, "BRIDGE_MISSING");
      setError(nextError);
      throw nextError;
    }
    if (!integration.capabilities.getLeaderboard) {
      const nextError = visibleError(undefined, "CAPABILITY_DENIED");
      setError(nextError);
      throw nextError;
    }

    setLoading(true);
    try {
      // 30 is the server's cap; anything larger is trimmed to it server-side.
      const board = await integration.client.getLeaderboard({ limit: 30 });
      setScores(mapRemoteScores(board.entries));
      setPersonalBest(board.me);
      setError(null);
    } catch (value) {
      const nextError = visibleError(value);
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [
    offline,
    integration.client,
    integration.capabilities.getLeaderboard,
  ]);

  useEffect(() => {
    const onFocus = () => {
      void refreshLeaderboard().catch(() => {
        // The visible error state is the user-facing result of a failed refresh.
      });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshLeaderboard]);

  const handleGameOver = useCallback(
    async (result: GameResultWithRound) => {
      const qualifies =
        result.qualifies === undefined
          ? Number.isFinite(result.score) && result.score > 0
          : result.qualifies;

      if (
        !Number.isFinite(result.score) ||
        result.score < 0 ||
        !Number.isInteger(result.score) ||
        !Number.isFinite(result.playTimeSec) ||
        result.playTimeSec < 0 ||
        !Number.isInteger(result.playTimeSec)
      ) {
        setError(visibleError(undefined, "INVALID_SCORE"));
        return;
      }
      if (!qualifies) return;

      if (offline) {
        const saved = saveLocalScore({
          uid: "local-player",
          playerName: "Người chơi",
          photoURL: null,
          score: result.score,
          playTimeSec: result.playTimeSec,
          createdAt: Date.now(),
        });
        if (saved) {
          const nextScores = readOfflineScores();
          setScores(nextScores);
          setLastScore(result.score);
          setError(null);
        } else {
          setError(visibleError(undefined, "API_NETWORK_ERROR"));
        }
        return;
      }

      if (!result.roundId) {
        setError(visibleError(undefined, "INVALID_ROUND"));
        return;
      }

      try {
        setScoreSubmissionError(null);
        await integration.submitFinalScore({
          roundId: result.roundId,
          score: result.score,
          playTimeSec: result.playTimeSec,
          qualifies,
        });
        setLastScore(result.score);
        setError(null);
      } catch (value) {
        // A denied or failed remote mutation is never converted into a local row.
        const nextError = visibleError(value);
        setError(nextError);
        setScoreSubmissionError(
          nextError.code === "CAPABILITY_DENIED" ? nextError : null,
        );
      }
    },
    [offline, integration.submitFinalScore],
  );

  // Online, the player's best now comes from the server rather than from the
  // last score this tab happened to submit — those differ for anyone who has
  // played before, and the page cap means the old fallback of scanning the
  // returned rows could not find them either.
  const bestScore = offline
    ? bestLocalScore(scores)
    : personalBest?.score ?? lastScore ?? 0;

  return {
    bestScore,
    lastScore,
    totalGamesPlayed: scores.length,
    leaderboard: scores,
    personalBest,
    loading,
    error,
    scoreSubmissionError,
    onGameOver: handleGameOver,
    refreshLeaderboard,
  };
}
