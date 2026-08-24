import { useCallback, useEffect, useState } from "react";
import { FruitGame } from "./FruitGame";
import type { GameResult } from "../../game/types";
import { Home, Pause, Settings, Trophy } from "lucide-react";
import { useGameSound } from "../../hooks/useSound";
import { SettingsPanel } from "./SettingsPanel";
import { audioManager } from "../../utils/audio-manager";

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
  const [hasActiveRun, setHasActiveRun] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [resumeRequired, setResumeRequired] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    if (hostPaused && hasActiveRun) setResumeRequired(true);
  }, [hostPaused, hasActiveRun]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && hasActiveRun) {
        setResumeRequired(true);
        audioManager.pauseBgm();
      }
    };
    const handleBlur = () => {
      if (hasActiveRun) {
        setResumeRequired(true);
        audioManager.pauseBgm();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [hasActiveRun]);

  const gameplayPaused = hasActiveRun && (manualPaused || hostPaused || resumeRequired);

  useEffect(() => {
    if (gameplayPaused) {
      audioManager.pauseBgm();
    } else if (hasActiveRun) {
      audioManager.resumeBgm();
    }
  }, [gameplayPaused, hasActiveRun]);

  const handleGameStart = useCallback(() => {
    setPanel(null);
  }, []);

  // 🎵 Sound — BGM managed by App.tsx, SFX for in-game slicing
  const { playSlice, playBomb } = useGameSound(sfxMuted);

  const toggle = () => setPanel((prev) => (prev === "settings" ? null : "settings"));

  const handlePause = () => {
    setManualPaused(true);
  };

  const handleResume = () => {
    setManualPaused(false);
    setResumeRequired(false);
    setPanel(null);
  };

  const handleRestart = () => {
    setManualPaused(false);
    setResumeRequired(false);
    setPanel(null);
    setRestartKey((key) => key + 1);
  };

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
    <div
      className="game-container"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        background: "var(--rice-paper)",
        display: "flex",
        flexDirection: "column",
        zIndex: 100,
        overflow: "hidden",
      }}
    >
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
          <Home size={15} />
        </button>

        {/* Right: Settings + Dashboard */}
        <div className="gameActions" style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onOpenLeaderboard}
            className="game-btn"
            aria-label="Bảng điểm"
            style={btnStyle}
          >
            <Trophy size={15} />
          </button>
          <button
            onClick={hasActiveRun ? handlePause : toggle}
            className="game-btn"
            aria-label={hasActiveRun ? "Tạm dừng" : "Cài đặt"}
            style={{ ...btnStyle, ...(panel ? { background: "color-mix(in srgb, var(--primary) 12%, transparent)", border: "2px solid var(--primary)" } : {}) }}
          >
            {hasActiveRun ? <Pause size={15} /> : <Settings size={15} />}
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
            onRunStateChange={setHasActiveRun}
            manualPaused={manualPaused}
            resumeRequired={resumeRequired}
            restartKey={restartKey}
            hostPaused={hostPaused}
            muted={sfxMuted}
            onPlaySlice={playSlice}
            onPlayBomb={playBomb}
            musicMuted={musicMuted}
            sfxMuted={sfxMuted}
            onToggleMusic={onToggleMusic}
            onToggleSfx={onToggleSfx}
            onResumePause={handleResume}
            onRestartPause={handleRestart}
          />
        </div>

        <div className="game-panel-layer">
          {panel === "settings" && <div className="gamePanelBackdrop" aria-hidden="true" />}
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
