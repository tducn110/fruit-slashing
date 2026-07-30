export interface GameResult {
  score: number;
  playTimeSec: number;
  roundId?: string;
  qualifies?: boolean;
  endReason?: "lives";
}

export function finalizeGameResult(
  result: GameResult,
  multiplier: number,
): GameResult {
  const safeMultiplier = multiplier === 2 ? 2 : 1;
  const score = result.score * safeMultiplier;
  return {
    ...result,
    score,
    qualifies: Number.isFinite(score) && score > 0,
  };
}
