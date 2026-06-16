import { useState, useCallback, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { saveRun, getLeaderboard, getUserStats, type ScoreRecord } from "../../lib/firebase";

export interface Run {
  id: string;
  player: string;
  score: number;
  date: string;
  combo: number;
}

export function useFirebaseStorage() {
  const { user, loading: authLoading } = useAuth();
  const [bestScore, setBestScore] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>([]);
  const [totalGamesPlayed, setTotalGamesPlayed] = useState(0);

  // ── Fetch leaderboard + user stats on mount ──────────────────────────
  useEffect(() => {
    // Fetch leaderboard immediately (no auth needed)
    getLeaderboard(10)
      .then(setLeaderboard)
      .catch(() => {});

    // Fetch user stats when logged in
    if (user) {
      getUserStats(user.uid)
        .then((stats) => {
          setBestScore(stats.bestScore);
          setTotalGamesPlayed(stats.totalGamesPlayed);
        })
        .catch(() => {});
    } else {
      // Reset stats when logged out
      setBestScore(0);
      setTotalGamesPlayed(0);
      setLastScore(null);
    }
  }, [user]);

  /** Called by GamePage when game ends — saves to Firestore + refreshes leaderboard. */
  const handleGameOver = useCallback(
    async (finalScore: number) => {
      setLastScore(finalScore);
      if (finalScore > bestScore) setBestScore(finalScore);
      setTotalGamesPlayed((n) => n + 1);

      if (user && finalScore > 0) {
        try {
          const playTimeSec = 180; // matches GAME_DURATION in FruitGame
          await saveRun(
            user.uid,
            user.displayName ?? "Người chơi",
            user.photoURL,
            finalScore,
            playTimeSec,
          );
          // Refresh leaderboard after save
          const lb = await getLeaderboard(10);
          setLeaderboard(lb);
        } catch (e) {
          console.warn("Firestore save failed", e);
        }
      }
    },
    [bestScore, user],
  );

  /** Fetch leaderboard on demand (e.g. when Dashboard panel opens). */
  const fetchLeaderboard = useCallback(async () => {
    try {
      const lb = await getLeaderboard(10);
      setLeaderboard(lb);
    } catch {
      // offline / not configured — silently fail
    }
  }, []);

  return {
    user,
    authLoading,
    bestScore,
    lastScore,
    totalGamesPlayed,
    leaderboard,
    onGameOver: handleGameOver,
    refreshLeaderboard: fetchLeaderboard,
  };
}
