import { useCallback, useEffect, useState } from "react";
import { FruitGame } from "./FruitGame";
import type { GameResult } from "../../game/types";
import { Home, Pause, Settings, Trophy } from "lucide-react";
import { DashboardPanel } from "./DashboardPanel";
import { SettingsPanel } from "./SettingsPanel";
import { audioManager } from "../../utils/audio-manager";
import type { LeaderboardEntry } from "../../lib/localScores";

interface Props {
  musicMuted: boolean;
  sfxMuted: boolean;
  hostPaused: boolean;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
  onGameStart?: () => void;
  onSaveScore: (result: GameResult) => void;
  onCompleteRound: (result: GameResult) => void;
  onHome: () => void;
  onRefreshLeaderboard: () => void;
  leaderboard: readonly LeaderboardEntry[];
  bestScore: number;
}

export function GamePage({
  musicMuted,
  sfxMuted,
  hostPaused,
  onToggleMusic,
  onToggleSfx,
  onGameStart,
  onSaveScore,
  onCompleteRound,
  onHome,
  onRefreshLeaderboard,
  leaderboard,
  bestScore,
}: Props) {
  const [panel, setPanel] = useState<null | "settings" | "leaderboard">(null);
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

  const gameplayPaused = hostPaused || manualPaused || resumeRequired;

  useEffect(() => {
    if (gameplayPaused) {
      audioManager.pauseBgm();
    } else if (hasActiveRun) {
      audioManager.resumeBgm();
    }
  }, [gameplayPaused, hasActiveRun]);

  const handleGameStart = useCallback(() => {
    setPanel(null);
    onGameStart?.();
  }, [onGameStart]);

  const toggleSettings = () => setPanel((prev) => (prev === "settings" ? null : "settings"));
  const toggleLeaderboard = () => {
    setPanel((prev) => {
      if (prev === "leaderboard") return null;
      if (hasActiveRun) setManualPaused(true);
      onRefreshLeaderboard();
      return "leaderboard";
    });
  };

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
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        {/* Top Floating Control Bar */}
        <div style={{
          position: "absolute",
          top: 14, left: 16, right: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          zIndex: 10,
          pointerEvents: "none",
        }}>
          {/* Left: Home button */}
          <button
            onClick={onHome}
            aria-label="Về trang chủ"
            style={{ ...btnStyle, pointerEvents: "auto" }}
          >
            <Home size={16} />
            <span style={{ fontSize: 12 }}>Trang chủ</span>
          </button>

          {/* Right: Pause, Leaderboard, Settings */}
          <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
            <button
              onClick={handlePause}
              aria-label="Tạm dừng"
              style={{ ...btnStyle, padding: "8px 12px" }}
              disabled={gameplayPaused}
            >
              <Pause size={16} />
            </button>
            <button
              onClick={toggleLeaderboard}
              aria-label="Bảng xếp hạng"
              style={{ ...btnStyle, padding: "8px 12px" }}
            >
              <Trophy size={16} />
            </button>
            <button
              onClick={toggleSettings}
              aria-label="Cài đặt"
              style={{ ...btnStyle, padding: "8px 12px" }}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* The Game Canvas */}
        <div style={{ width: "100%", height: "100%" }}>
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
            musicMuted={musicMuted}
            sfxMuted={sfxMuted}
            onToggleMusic={onToggleMusic}
            onToggleSfx={onToggleSfx}
            onResumePause={handleResume}
            onRestartPause={handleRestart}
          />
        </div>

        <div className="game-panel-layer">
          {panel !== null && <div className="gamePanelBackdrop" aria-hidden="true" />}
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
          {panel === "leaderboard" && (
            <DashboardPanel
              leaderboard={leaderboard}
              bestScore={bestScore}
              onClose={() => setPanel(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
