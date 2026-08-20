import { useState, useCallback, useEffect } from "react";
import { TopNav } from "./components/ui/TopNav";
import { HeroSection } from "./components/ui/HeroSection";
import { GamePage } from "./components/game/GamePage";
import { LeaderboardScreen } from "./components/game/DashboardPanel";
import { audioManager } from "./utils/audio-manager";
import { preloadGameResources } from "./utils/game-loader";

import { useScoreData } from "./hooks/useScoreData";
import { IntegrationStatusBanner } from "./components/ui/IntegrationStatusBanner";
import { useWinkIntegration } from "./integrations/wink/useWinkIntegration";
import type { GameResult } from "./game/types";

type AppView = "landing" | "game" | "leaderboard";
type LeaderboardReturnView = "landing" | "game";

export default function App() {
  const integration = useWinkIntegration();
  const {
    bestScore,
    leaderboard,
    onGameOver,
    refreshLeaderboard,
    scoreSubmissionError,
  } = useScoreData(integration);

  const [view, setView] = useState<AppView>("landing");
  const [musicMuted, setMusicMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [leaderboardReturnView, setLeaderboardReturnView] = useState<LeaderboardReturnView>("game");

  // Sync mute state to audio manager.
  useEffect(() => {
    audioManager.setMusicMuted(musicMuted);
  }, [musicMuted]);

  useEffect(() => {
    audioManager.setSfxMuted(sfxMuted);
  }, [sfxMuted]);

  useEffect(() => {
    audioManager.setParentMuted(integration.parentMuted);
  }, [integration.parentMuted]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        audioManager.pauseBgm();
      } else if (view !== "game") {
        audioManager.resumeBgm();
      }
    };
    const handleBlur = () => {
      audioManager.pauseBgm();
    };
    const handleFocus = () => {
      if (view !== "game") audioManager.resumeBgm();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [view]);

  useEffect(() => {
    const playButtonClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;

      audioManager.playButtonSfx();
    };

    document.addEventListener("click", playButtonClick, true);
    return () => document.removeEventListener("click", playButtonClick, true);
  }, []);

  // Bootstrap once in background: SFX decoding and web fonts.
  useEffect(() => {
    void preloadGameResources().catch((error) => {
      console.error("Game resource preload failed", error);
    });
  }, []);

  // BGM is heavy (~1.5MB) — fetch it during browser idle, never block UI.
  useEffect(() => {
    const preloadBgm = () => { void audioManager.preloadBgm(); };

    // requestIdleCallback is not available in every mobile Safari/WebView.
    // This preload is optional, so fall back to a cancellable timer instead
    // of allowing a missing API to crash the whole React tree on mount.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(preloadBgm, { timeout: 3000 });
      return () => {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(id);
        }
      };
    }

    const timeoutId = window.setTimeout(preloadBgm, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  // "Chơi ngay" -> directly enter game (countdown handled by FruitGame)
  const handlePlay = useCallback(async () => {
    try {
      await audioManager.unlock();
      if (!audioManager.bgmPlaying) {
        audioManager.playBgm(audioManager.gameBgmVolume);
      } else {
        audioManager.setBgmVolume(audioManager.gameBgmVolume);
      }
    } catch (error) {
      console.warn("Audio unlock failed", error);
    }
    setView("game");
  }, []);

  const handleHome = useCallback(() => {
    audioManager.setBgmVolume(audioManager.landingBgmVolume);
    void refreshLeaderboard().catch(() => {
      // useScoreData owns the visible error state for a failed refresh.
    });
    setView("landing");
  }, [refreshLeaderboard]);

  const handleCompleteRound = useCallback(
    (result: GameResult) => {
      if (!result.roundId) return;
      void integration.completeRound({
        roundId: result.roundId,
        playDurationMs: result.playTimeSec * 1000,
      }).catch(() => {
        // The integration status banner exposes the typed completion error.
      });
    },
    [integration.completeRound],
  );

  const handleOpenLeaderboard = useCallback((returnView: LeaderboardReturnView) => {
    void refreshLeaderboard().catch(() => {
      // useScoreData owns the visible error state for a failed refresh.
    });
    setLeaderboardReturnView(returnView);
    setView("leaderboard");
  }, [refreshLeaderboard]);


  // Game view — full screen, dashboard panel opens on demand inside GamePage
  if (view === "game") {
    return (
      <>
        <IntegrationStatusBanner
          integration={integration}
          operationError={scoreSubmissionError}
        />
        <GamePage
          musicMuted={musicMuted}
          sfxMuted={sfxMuted}
          hostPaused={integration.hostPaused}
          onToggleMusic={() => setMusicMuted((m) => !m)}
          onToggleSfx={() => setSfxMuted((m) => !m)}
          onSaveScore={onGameOver}
          onCompleteRound={handleCompleteRound}
          onHome={handleHome}
          onOpenLeaderboard={() => handleOpenLeaderboard("game")}
        />
      </>
    );
  }

  if (view === "leaderboard") {
    return (
      <>
        <IntegrationStatusBanner
          integration={integration}
          operationError={scoreSubmissionError}
        />
        <LeaderboardScreen
          leaderboard={leaderboard}
          bestScore={bestScore}
          onBack={() => setView(leaderboardReturnView)}
        />
      </>
    );
  }

  // Landing view — just nav + hero, no dashboard/footer sections
  return (
    <>
      <IntegrationStatusBanner
        integration={integration}
        operationError={scoreSubmissionError}
      />
      <div
        className="landing-enter"
        style={{
          minHeight: "100vh",
          background: "#f5ecd7",
          fontFamily: "'Be Vietnam Pro', sans-serif",
          color: "#2a2418",
        }}
      >
        <TopNav
          muted={musicMuted}
          onToggleMute={() => setMusicMuted((m) => !m)}
        />

        <HeroSection
          onPlay={handlePlay}
          onOpenLeaderboard={() => handleOpenLeaderboard("landing")}
          bestScore={bestScore}
        />
      </div>
    </>
  );
}
