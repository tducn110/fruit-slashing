import { useState, useCallback, useEffect, useRef } from "react";
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
  const [saveError, setSaveError] = useState<string | null>(null);

  // 🔥 Use refs to avoid stale closure — always read latest user/bestScore
  const userRef = useRef(user);
  userRef.current = user;
  const bestScoreRef = useRef(bestScore);
  bestScoreRef.current = bestScore;

  // ── Fetch leaderboard + user stats on mount / user change ──────────
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
      const currentUser = userRef.current;
      const currentBest = bestScoreRef.current;

      setLastScore(finalScore);
      if (finalScore > currentBest) setBestScore(finalScore);
      setTotalGamesPlayed((n) => n + 1);
      setSaveError(null);

      if (currentUser && finalScore > 0) {
        try {
          console.log("[Firestore] Saving run for", currentUser.uid, "score:", finalScore);
          const playTimeSec = 180;
          await saveRun(
            currentUser.uid,
            currentUser.displayName ?? "Người chơi",
            currentUser.photoURL,
            finalScore,
            playTimeSec,
          );
          console.log("[Firestore] Save OK, refreshing leaderboard...");
          const lb = await getLeaderboard(10);
          setLeaderboard(lb);
        } catch (e: any) {
          const msg = e?.message ?? String(e);
          console.error("[Firestore] Save FAILED:", msg);

          // Detect common Firebase errors
          if (msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
            setSaveError("Không thể lưu điểm: Firestore rules chưa cho phép ghi. Vui lòng cập nhật rules.");
          } else if (msg.includes("unavailable") || msg.includes("network")) {
            setSaveError("Không có kết nối mạng. Điểm sẽ không được lưu.");
          } else {
            setSaveError("Lưu điểm thất bại: " + msg.slice(0, 80));
          }
        }
      } else if (!currentUser) {
        console.log("[Firestore] Skipped save — user not logged in (score:", finalScore, ")");
      }
    },
    [], // 🔥 empty deps — uses refs for latest values
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
    saveError,
    onGameOver: handleGameOver,
    refreshLeaderboard: fetchLeaderboard,
  };
}
