import { useCallback, useEffect, useState } from "react";
import type { GameResult } from "../game/types";
import {
  getLocalScores,
  saveLocalScore,
  type LocalScore,
} from "../lib/localScores";

function readLocalScores() {
  return getLocalScores().slice(0, 100);
}

export function useScoreData() {
  const [scores, setScores] = useState<LocalScore[]>(readLocalScores);
  const [lastScore, setLastScore] = useState<number | null>(scores[0]?.score ?? null);

  const refreshLeaderboard = useCallback(() => {
    setScores(readLocalScores());
  }, []);

  useEffect(() => {
    const onFocus = () => refreshLeaderboard();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshLeaderboard]);

  const handleGameOver = useCallback((result: GameResult) => {
    setLastScore(result.score);

    if (!Number.isFinite(result.score) || result.score < 0) {
      console.error("Invalid score:", result.score);
      return;
    }

    const saved = saveLocalScore({
      uid: "local-player",
      playerName: "Người chơi",
      photoURL: null,
      score: result.score,
      playTimeSec: result.playTimeSec,
      createdAt: Date.now(),
    });

    if (saved) {
      setScores(readLocalScores());
    }
  }, []);

  return {
    bestScore: scores[0]?.score ?? 0,
    lastScore,
    totalGamesPlayed: scores.length,
    leaderboard: scores,
    onGameOver: handleGameOver,
    refreshLeaderboard,
  };
}
