export interface GameResult {
  score: number;
  playTimeSec: number;
  endReason?: "lives";
}
