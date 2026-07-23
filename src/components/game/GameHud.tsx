import { useEffect, useState } from "react";

export interface HudState {
  score: number;
  lives: number;
  combo: number;
}

interface GameHudProps {
  hud: HudState;
  running: boolean;
}

export function GameHud({ hud, running }: GameHudProps) {
  const [animKey, setAnimKey] = useState(0);
  const [animClass, setAnimClass] = useState("");

  useEffect(() => {
    if (hud.score > 0) {
      setAnimKey(prev => prev + 1);
      if (hud.combo >= 4) {
        setAnimClass("score-animate-shake-heavy");
      } else if (hud.combo >= 2) {
        setAnimClass("score-animate-shake");
      } else {
        setAnimClass("score-animate-bump");
      }
    }
  }, [hud.score, hud.combo]);

  return (
    <div className="gameHud">
      <div key={animKey} className={`score-text ${animClass}`}>Điểm: {hud.score}</div>

      <div className="gameLives">
        {hud.lives > 0 ? "♥".repeat(hud.lives) : "✕"}
      </div>
    </div>
  );
}
