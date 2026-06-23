export interface HudState {
  score: number;
  lives: number;
  combo: number;
  time: number;
}

interface GameHudProps {
  hud: HudState;
  running: boolean;
}

export function GameHud({ hud, running }: GameHudProps) {
  return (
    <div className="gameHud">
      <div style={{ fontSize: 20, fontWeight: 700 }}>Điểm: {hud.score}</div>

      {running && (
        <div className={`gameTimer ${hud.time <= 15 ? "danger" : ""}`}>
          {String(Math.floor(hud.time / 60)).padStart(2, "0")}:
          {String(hud.time % 60).padStart(2, "0")}
        </div>
      )}

      <div className="gameLives">
        {hud.lives > 0 ? "♥".repeat(hud.lives) : "✕"}
      </div>
    </div>
  );
}
