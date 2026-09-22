import { useCallback, useEffect, useRef, useState } from "react";
import { FruitGame } from "./FruitGame";
import type { GameResult } from "../../game/types";
import { Home, Pause, Trophy } from "lucide-react";
import { DashboardPanel } from "./DashboardPanel";
import { audioManager } from "../../utils/audio-manager";
import type { LeaderboardEntry } from "../../lib/localScores";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [panel, setPanel] = useState<null | "leaderboard">(null);
  const [hasActiveRun, setHasActiveRun] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [resumeRequired, setResumeRequired] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const prevHostPausedRef = useRef(hostPaused);

  // Focus loss (blur & visibility hidden): pause active run
  useEffect(() => {
    const handleLostFocus = () => {
      if (hasActiveRun) {
        setManualPaused(true);
        setResumeRequired(true);
        audioManager.pauseBgm();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        handleLostFocus();
      }
    };

    const handleBlur = () => {
      handleLostFocus();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [hasActiveRun]);

  // Wink SDK contract: when host pauses, pause gameplay
  useEffect(() => {
    const wasHostPaused = prevHostPausedRef.current;
    prevHostPausedRef.current = hostPaused;

    if (hostPaused) {
      setManualPaused(true);
      audioManager.pauseBgm();
    } else if (wasHostPaused && !hostPaused) {
      setManualPaused(false);
      setResumeRequired(false);
    }
  }, [hostPaused]);

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
    audioManager.pauseBgm();
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
            aria-label={t("game.home", "Home")}
            style={{ ...btnStyle, pointerEvents: "auto" }}
          >
            <Home size={16} />
            <span style={{ fontSize: 12 }}>{t("game.home", "Home")}</span>
          </button>

          {/* Right: Pause, Leaderboard */}
          <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
            <button
              onClick={handlePause}
              aria-label={t("game.pause", "Pause")}
              style={{ ...btnStyle, padding: "8px 12px" }}
              disabled={gameplayPaused}
            >
              <Pause size={16} />
            </button>
            <button
              onClick={toggleLeaderboard}
              aria-label={t("game.leaderboard", "Leaderboard")}
              style={{ ...btnStyle, padding: "8px 12px" }}
            >
              <Trophy size={16} />
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
            suppressPauseOverlay={panel !== null}
          />
        </div>

        <div className="game-panel-layer">
          {panel !== null && (
            <div
              className="gamePanelBackdrop"
              aria-hidden="true"
              onClick={() => setPanel(null)}
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
