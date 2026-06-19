import { useCallback, useEffect, useState } from "react";
import { FruitGame } from "./FruitGame";
import type { GameResult } from "../../game/types";
import { Home, Settings, Trophy } from "lucide-react";
import type { User } from "firebase/auth";
import type { ScoreRecord } from "../../lib/firebase";
import { useGameSound } from "../../hooks/useSound";
import { DashboardPanel } from "./DashboardPanel";
import { SettingsPanel } from "./SettingsPanel";

interface Props {
  muted: boolean;
  onToggleMute: () => void;
  user: User | null;
  bestScore: number;
  lastScore: number | null;
  totalGamesPlayed: number;
  leaderboard: ScoreRecord[];
  saveError?: string | null;
  savingScore?: boolean;
  onGameOver: (result: GameResult) => void;
  onHome: () => void;
  onRefreshLeaderboard: () => void;
  onLoginPrompt: () => void;
}

export function GamePage({
  muted,
  onToggleMute,
  user,
  bestScore,
  lastScore,
  totalGamesPlayed,
  leaderboard,
  saveError,
  savingScore,
  onGameOver,
  onHome,
  onRefreshLeaderboard,
  onLoginPrompt,
}: Props) {
  const [panel, setPanel] = useState<null | "settings" | "dashboard">(null);

  // 🎵 Sound — BGM managed by App.tsx, SFX for in-game slicing
  const { playSlice, playBomb } = useGameSound(muted);

  // Refresh leaderboard when dashboard opens
  useEffect(() => {
    if (panel === "dashboard") onRefreshLeaderboard();
  }, [panel, onRefreshLeaderboard]);

  // Auto-open dashboard on game over
  const handleGameOver = useCallback((result: GameResult) => {
    onGameOver(result);
    setPanel("dashboard");
  }, [onGameOver]);

  const toggle = (p: "settings" | "dashboard") =>
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
        <button onClick={onHome} className="game-btn" style={btnStyle}>
          <Home size={15} /> <span className="btnLabel">Trang chủ</span>
        </button>

        {/* Center: title */}
        <span className="gameTitle" style={{
          fontWeight: 800, fontSize: 16, color: "var(--ink-dark)",
          fontFamily: "var(--font-family)",
          letterSpacing: 0.5,
        }}>
          Chém Lạc <span className="gameSub" style={{ color: "var(--primary)" }}>Vùng Cao</span>
        </span>

        {/* Right: Settings + Dashboard */}
        <div className="gameActions" style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => toggle("dashboard")}
            className="game-btn"
            style={{ ...btnStyle, ...(panel === "dashboard" ? { background: "color-mix(in srgb, var(--primary) 12%, transparent)", border: "2px solid var(--primary)" } : {}) }}
          >
            <Trophy size={15} /> <span className="btnLabel">Bảng điểm</span>
          </button>
          <button
            onClick={() => toggle("settings")}
            className="game-btn"
            style={{ ...btnStyle, ...(panel === "settings" ? { background: "color-mix(in srgb, var(--primary) 12%, transparent)", border: "2px solid var(--primary)" } : {}) }}
          >
            <Settings size={15} /> Cài đặt
          </button>
        </div>
      </div>

      {/* Game canvas — fills remaining space */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div className="game-canvas-layer">
          <FruitGame
            onGameOver={handleGameOver}
            muted={muted}
            onPlaySlice={playSlice}
            onPlayBomb={playBomb}
          />
        </div>

        <div className="game-panel-layer">
          {/* Settings overlay */}
          {panel === "settings" && (
            <SettingsPanel
              muted={muted}
              onToggleMute={onToggleMute}
              bestScore={bestScore}
              lastScore={lastScore}
              totalGamesPlayed={totalGamesPlayed}
              user={user}
              onClose={() => setPanel(null)}
            />
          )}

          {/* Dashboard overlay */}
          {panel === "dashboard" && (
            <DashboardPanel
              leaderboard={leaderboard}
              user={user}
              savingScore={savingScore}
              saveError={saveError}
              onLoginPrompt={onLoginPrompt}
              onClose={() => setPanel(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
