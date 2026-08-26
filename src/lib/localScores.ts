import i18n from "../i18n";

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
  if (bestScore >= 700) return i18n.t('game.ranks.legend');
  if (bestScore >= 400) return i18n.t('game.ranks.king');
  if (bestScore >= 250) return i18n.t('game.ranks.master');
  if (bestScore >= 100) return i18n.t('game.ranks.apprentice');
  return i18n.t('game.ranks.newbie');
}

export function readOfflineScores(): LeaderboardEntry[] {
  try {
    const data = localStorage.getItem("wink_scores");
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function bestLocalScore(scores: LeaderboardEntry[]): number {
  return scores.reduce((max, s) => Math.max(max, s.score), 0);
}
