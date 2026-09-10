import { useCallback, useEffect, useState } from "react";
import type { GameResult } from "../game/types";
import { bestLocalScore, readOfflineScores, type LeaderboardEntry } from "../lib/localScores";
import type {
  WinkIntegration,
  WinkIntegrationError,
  WinkIntegrationErrorCode,
  WinkLeaderboardEntry,
} from "../integrations/wink/types";

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
  BRIDGE_MISSING: "Wink SDK chưa sẵn sàng.",
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
    typeof value === "object" && value !== null && "code" in value
      ? (value as { code?: unknown }).code
      : value;
  const code = isErrorCode(candidateCode) ? candidateCode : fallbackCode;
  const retryable = code === "API_NETWORK_ERROR" || code === "BRIDGE_READY_TIMEOUT";
  return Object.freeze({
    code,
    message: SAFE_ERROR_MESSAGES[code],
    retryable,
  });
}

function mapRemoteScores(
  entries: readonly WinkLeaderboardEntry[],
): LeaderboardEntry[] {
  return entries.map((entry) => ({
    name: entry.displayName ?? "Anonymous player",
    score: entry.score,
    playTimeSec: entry.playTime ?? 0,
    isLocal: false,
    rank: entry.rank,
  }));
}

export function useScoreData(integration: WinkIntegration) {
  const isStandalone = integration.status === "standalone";
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [error, setError] = useState<WinkIntegrationError | null>(
    integration.error,
  );
  const [scoreSubmissionError, setScoreSubmissionError] =
    useState<WinkIntegrationError | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (integration.error) {
      setError(integration.error);
      if (integration.error.code === "CAPABILITY_DENIED") {
        setScoreSubmissionError(integration.error);
      }
    }
  }, [integration.error]);

  useEffect(() => {
    if (!scoreSubmissionError) return;
    const timeoutId = window.setTimeout(
      () => setScoreSubmissionError(null),
      SCORE_BLOCKED_NOTICE_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [scoreSubmissionError]);

  useEffect(() => {
    if (isStandalone) {
      setScores(readOfflineScores());
    } else if (integration.leaderboard.length > 0) {
      setScores(mapRemoteScores(integration.leaderboard));
    }
  }, [isStandalone, integration.leaderboard]);

  const refreshLeaderboard = useCallback(async () => {
    if (isStandalone) {
      setScores(readOfflineScores());
      setError(null);
      return;
    }

    setLoading(true);
    try {
      await integration.refreshLeaderboard();
      setError(null);
    } catch (value) {
      const nextError = visibleError(value);
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, [isStandalone, integration.refreshLeaderboard]);

  useEffect(() => {
    const onFocus = () => {
      void refreshLeaderboard().catch(() => {});
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

      if (isStandalone) {
        setLastScore(result.score);
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
        const nextError = visibleError(value);
        setError(nextError);
        setScoreSubmissionError(
          nextError.code === "CAPABILITY_DENIED" ? nextError : null,
        );
      }
    },
    [isStandalone, integration.submitFinalScore],
  );

  const bestScore = isStandalone
    ? bestLocalScore(scores)
    : integration.personalBest?.score ?? lastScore ?? 0;

  return {
    bestScore,
    lastScore,
    totalGamesPlayed: scores.length,
    leaderboard: scores,
    personalBest: integration.personalBest,
    loading,
    error,
    scoreSubmissionError,
    onGameOver: handleGameOver,
    refreshLeaderboard,
  };
}
