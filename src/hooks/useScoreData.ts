import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getLeaderboard, getUserStats, saveScore, type ScoreRecord } from "../lib/firebase";
import type { GameResult } from "../game/types";
import {
  getLocalScores,
  saveLocalScore,
  type LocalScore,
} from "../lib/localScores";

function firebaseErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("permission-denied") || message.includes("unauthenticated")) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (message.includes("unavailable") || message.includes("network")) return "Không có kết nối tới máy chủ lưu điểm.";
  return "Không thể lưu điểm lúc này. Ván này sẽ không được xếp hạng.";
}

export function useScoreData() {
  const { user, loading: authLoading } = useAuth();
  const [bestScore, setBestScore] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>([]);
  const [totalGamesPlayed, setTotalGamesPlayed] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingScore, setSavingScore] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLeaderboard(await getLeaderboard(10));
    } catch {
      setLeaderboard(getLocalScores().slice(0, 10));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void fetchLeaderboard();
    if (!user) {
      const localScores = getLocalScores();
      setBestScore(localScores[0]?.score ?? 0);
      setTotalGamesPlayed(localScores.length);
      setLastScore(null);
      return;
    }

    getUserStats(user.uid)
      .then((stats) => {
        if (cancelled) return;
        setBestScore(stats.bestScore);
        setTotalGamesPlayed(stats.totalGamesPlayed);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [fetchLeaderboard, user]);

  const handleGameOver = useCallback(async (result: GameResult) => {
    setLastScore(result.score);

    if (!Number.isFinite(result.score) || result.score < 0) {
      console.error("Invalid score:", result.score);
      setSaveError("Điểm không hợp lệ.");
      return;
    }

    const fallbackScore: LocalScore = {
      uid: user?.uid || "local-player",
      playerName: user?.displayName || "Người chơi",
      photoURL: user?.photoURL || null,
      score: result.score,
      playTimeSec: result.playTimeSec,
      createdAt: Date.now(),
    };

    setSavingScore(true);
    setSaveError(null);
    try {
      if (!user) {
        const savedRecord = saveLocalScore(fallbackScore);
        if (!savedRecord) throw new Error("Failed to save score locally");
        setBestScore((current) => Math.max(current, result.score));
        setTotalGamesPlayed((current) => current + 1);
        setLeaderboard(getLocalScores().slice(0, 10));
        return;
      }

      const verifiedScore = await saveScore(user, result.score, result.playTimeSec);

      if (!Number.isFinite(verifiedScore) || verifiedScore < 0) {
        throw new Error("Invalid score returned from server");
      }

      setLastScore(verifiedScore);
      setBestScore((current) => Math.max(current, verifiedScore));
      setTotalGamesPlayed((current) => current + 1);
      await fetchLeaderboard();
    } catch (error) {
      console.warn("Remote score submission failed, saving locally:", error);
      setSaveError("Bảng điểm online tạm thời không khả dụng, đang dùng lưu tạm trên máy.");
      const savedRecord = saveLocalScore(fallbackScore);
      if (!savedRecord) {
        setSaveError(firebaseErrorMessage(error));
        return;
      }

      setBestScore((current) => Math.max(current, result.score));
      setTotalGamesPlayed((current) => current + 1);
      setLeaderboard(getLocalScores().slice(0, 10));
    } finally {
      setSavingScore(false);
    }
  }, [fetchLeaderboard, user]);

  return {
    user,
    authLoading,
    bestScore,
    lastScore,
    totalGamesPlayed,
    leaderboard,
    saveError,
    savingScore,
    onGameOver: handleGameOver,
    refreshLeaderboard: fetchLeaderboard,
  };
}
