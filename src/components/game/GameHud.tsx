export interface HudState {
  score: number;
  lives: number;
  combo: number;
}

interface GameHudProps {
  hud: HudState;
  running: boolean;
}

export function GameHud({ hud }: GameHudProps) {
  const animClass = hud.score <= 0 ? "" : hud.combo >= 4
    ? "score-animate-shake-heavy"
    : hud.combo >= 2 ? "score-animate-shake" : "score-animate-bump";
  const animKey = `${hud.score}:${hud.combo}`;

  return (
    <div className="gameHud">
      <div key={animKey} className={`score-text ${animClass}`}>{hud.score}</div>

      <div className="gameLives">
        {hud.lives > 0 ? "♥".repeat(hud.lives) : "✕"}
      </div>
    </div>
  );
}
