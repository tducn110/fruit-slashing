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
