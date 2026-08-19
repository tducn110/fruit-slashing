const LOCAL_SCORES_KEY = "fruit-game-scores";

export interface LocalScore {
  uid: string;
  playerName: string;
  photoURL: string | null;
  score: number;
  playTimeSec: number;
  createdAt: number;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  playTimeSec: number;
  isLocal?: boolean;
  rank?: number;
}

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number | undefined;
}

export const BADGE_COLORS = [
  { bg: "#f0b840", border: "#c8941a", text: "#2a2418" },
  { bg: "#d0c4a0", border: "#a8a080", text: "#2a2418" },
  { bg: "#d99258", border: "#a86e38", text: "#fff8ee" },
] as const;

export function getRank(bestScore: number): string {
  if (bestScore >= 700) return "Huyền Thoại";
  if (bestScore >= 400) return "Vua Chém";
  if (bestScore >= 250) return "Cao Thủ";
  if (bestScore >= 100) return "Tập Sự";
  return "Mầm Non";
}

export function saveLocalScore(localScore: LocalScore): LocalScore | null {
  if (!Number.isFinite(localScore.score) || localScore.score < 0) {
    console.error("Invalid local fallback score:", localScore.score);
    return null;
  }

  try {
    const stored = localStorage.getItem(LOCAL_SCORES_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    const scores: LocalScore[] = Array.isArray(parsed) ? parsed : [];
    scores.push(localScore);
    scores.sort((a, b) => b.score - a.score);
    const trimmedScores = scores.slice(0, 100);
    localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(trimmedScores));
    if (import.meta.env.DEV) {
      console.log("[ScoreData] saved local fallback score", localScore);
    }
    return localScore;
  } catch (error) {
    console.error("Failed to save score to localStorage:", error);
    try {
      const fallbackScores = [localScore];
      localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(fallbackScores));
      if (import.meta.env.DEV) {
        console.log("[ScoreData] saved local fallback score", localScore);
      }
      return localScore;
    } catch (storageError) {
      console.error("Failed to reset corrupt local scores:", storageError);
    }
    return null;
  }
}

export function getLocalScores(): LocalScore[] {
  try {
    const stored = localStorage.getItem(LOCAL_SCORES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    const scores: LocalScore[] = Array.isArray(parsed) ? parsed : [];
    return scores.map((s) => ({
      uid: s.uid,
      playerName: s.playerName,
      photoURL: s.photoURL,
      score: s.score,
      playTimeSec: s.playTimeSec,
      createdAt: s.createdAt,
    }));
  } catch {
    return [];
  }
}
