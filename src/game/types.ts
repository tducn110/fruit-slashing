export interface GameResult {
  score: number;
  playTimeSec: number;
  endReason?: "timeout" | "lives";
}
