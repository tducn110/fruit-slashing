import { useCallback, useState } from "react";
import { FruitGame } from "./FruitGame";
import type { GameResult } from "../../game/types";
import { Home, Settings, Trophy } from "lucide-react";
import { useGameSound } from "../../hooks/useSound";
import { SettingsPanel } from "./SettingsPanel";

interface Props {
  musicMuted: boolean;
  sfxMuted: boolean;
  hostPaused: boolean;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
  onSaveScore: (result: GameResult) => void;
  onCompleteRound: (result: GameResult) => void;
  onHome: () => void;
  onOpenLeaderboard: () => void;
}

export function GamePage({
  musicMuted,
  sfxMuted,
  hostPaused,
  onToggleMusic,
  onToggleSfx,
  onSaveScore,
  onCompleteRound,
  onHome,
  onOpenLeaderboard,
}: Props) {
  const [panel, setPanel] = useState<null | "settings">(null);

  const handleGameStart = useCallback(() => {
    setPanel(null);
  }, []);

  // 🎵 Sound — BGM managed by App.tsx, SFX for in-game slicing
  const { playSlice, playBomb } = useGameSound(sfxMuted);

  const toggle = (p: "settings") =>
    setPanel((prev) => (prev === p ? null : p));

  const btnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6,
    padding: "8px 16px", borderRadius: 999,
    border: "2px solid var(--border)",
    background: "rgba(255,255,255,0.88)",
    color: "var(--ink-dark)", fontWeight: 700, fontSize: 13,
    cursor: "pointer", backdropFilter: "blur(6px)",
    fontFamily: "var(--font-family)",
    boxShadow: "0 2px 8px rgba(42,36,24,0.12)",
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "var(--rice-paper)",
      display: "flex", flexDirection: "column",
      zIndex: 100,
    }}>
      {/* Top bar */}
      <div className="gameTopBar" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: "color-mix(in srgb, var(--rice-paper) 92%, transparent)",
        borderBottom: "1.5px solid var(--border)",
        backdropFilter: "blur(8px)",
        zIndex: 10,
        flexShrink: 0,
      }}>
        {/* Left: home */}
        <button onClick={onHome} className="game-btn" style={btnStyle} aria-label="Trang chủ">
          <Home size={15} /> <span className="btnLabel">Trang chủ</span>
        </button>

        {/* Center: title */}
        <span className="gameTitle" style={{
          fontWeight: 800, fontSize: 16, color: "var(--ink-dark)",
          fontFamily: "var(--font-family)",
          letterSpacing: 0,
        }}>
          <span className="game-title-brand">Chém Lạc</span>{" "}
          <span className="gameSub game-title-accent" style={{ color: "var(--primary)" }}>Vùng Cao</span>
        </span>

        {/* Right: Settings + Dashboard */}
        <div className="gameActions" style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onOpenLeaderboard}
            className="game-btn"
            aria-label="Bảng điểm"
            style={btnStyle}
          >
            <Trophy size={15} /> <span className="btnLabel">Bảng điểm</span>
          </button>
          <button
            onClick={() => toggle("settings")}
            className="game-btn"
            aria-label="Cài đặt"
            style={{ ...btnStyle, ...(panel === "settings" ? { background: "color-mix(in srgb, var(--primary) 12%, transparent)", border: "2px solid var(--primary)" } : {}) }}
          >
            <Settings size={15} /> <span className="btnLabel">Cài đặt</span>
          </button>
        </div>
      </div>

      {/* Game canvas — fills remaining space */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div className="game-canvas-layer">
          <FruitGame
            onSubmitScore={onSaveScore}
            onCompleteRound={onCompleteRound}
            onExitGame={onHome}
            onGameStart={handleGameStart}
            hostPaused={hostPaused}
            muted={sfxMuted}
            onPlaySlice={playSlice}
            onPlayBomb={playBomb}
          />
        </div>

        <div className="game-panel-layer">
          {/* Settings overlay */}
          {panel === "settings" && (
            <SettingsPanel
              musicMuted={musicMuted}
              sfxMuted={sfxMuted}
              onToggleMusic={onToggleMusic}
              onToggleSfx={onToggleSfx}
              onClose={() => setPanel(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
