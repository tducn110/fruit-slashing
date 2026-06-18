import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../contexts/AuthContext";
import { functions, getLeaderboard, getUserStats, type ScoreRecord } from "../lib/firebase";
import type { GameResult, GameSession } from "../components/game/FruitGame";

interface SubmitGameResponse {
  score: number;
  rank: string;
  runId: string | null;
}

const callSubmitScore = httpsCallable<Pick<GameResult, "score">, SubmitGameResponse>(functions, "submitScore");

function randomSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] || Date.now();
}

function firebaseErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("permission-denied") || message.includes("unauthenticated")) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (message.includes("unavailable") || message.includes("network")) return "Không có kết nối tới máy chủ lưu điểm.";
  return "Không thể lưu điểm lúc này. Ván này sẽ không được xếp hạng.";
}

export function useFirebaseStorage() {
  const { user, loading: authLoading } = useAuth();
  const [bestScore, setBestScore] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>([]);
  const [totalGamesPlayed, setTotalGamesPlayed] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [verifyingScore, setVerifyingScore] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLeaderboard(await getLeaderboard(10));
    } catch {
      // Keep the last successful snapshot while offline.
    }
  }, []);

  useEffect(() => {
    void fetchLeaderboard();
    if (!user) {
      setBestScore(0);
      setTotalGamesPlayed(0);
      setLastScore(null);
      return;
    }
    getUserStats(user.uid)
      .then((stats) => {
        setBestScore(stats.bestScore);
        setTotalGamesPlayed(stats.totalGamesPlayed);
      })
      .catch(() => undefined);
  }, [fetchLeaderboard, user]);

  const beginGame = useCallback(async (): Promise<GameSession> => {
    setSaveError(null);
    return { seed: randomSeed() };
  }, []);

  const handleGameOver = useCallback(async (result: GameResult) => {
    setLastScore(result.score);
    if (!user) return;
    setVerifyingScore(true);
    setSaveError(null);
    try {
      const response = await callSubmitScore({ score: result.score });
      const verifiedScore = response.data.score;
      setLastScore(verifiedScore);
      setBestScore((current) => Math.max(current, verifiedScore));
      setTotalGamesPlayed((current) => current + 1);
      await fetchLeaderboard();
    } catch (error) {
      setSaveError(firebaseErrorMessage(error));
    } finally {
      setVerifyingScore(false);
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
    verifyingScore,
    beginGame,
    onGameOver: handleGameOver,
    refreshLeaderboard: fetchLeaderboard,
  };
}
