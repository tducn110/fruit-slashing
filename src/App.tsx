import { useState, useCallback, useEffect } from "react";
import { TopNav } from "./components/ui/TopNav";
import { HeroSection } from "./components/ui/HeroSection";
import { GamePage } from "./components/game/GamePage";
import { LeaderboardScreen } from "./components/game/DashboardPanel";
import { audioManager } from "./utils/audio-manager";
import {
  preloadCriticalResources,
  preloadNonCriticalResources,
} from "./utils/game-loader";
import {
  completeGameLoading,
  onGameLoadingDismiss,
  setGameLoadingProgress,
} from "./utils/loading-controller";

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

  const { personalBest, refreshPersonalBest } = integration;

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
    if (integration.hostPaused) {
      audioManager.pauseBgm();
    } else if (view !== "game" && !musicMuted) {
      audioManager.resumeBgm();
    }
  }, [integration.hostPaused, view, musicMuted]);

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

  // Unlock audio and start landing BGM when loading screen dismisses; trigger idle preloads
  useEffect(() => {
    const unbind = onGameLoadingDismiss(() => {
      void audioManager.unlock().then(() => {
        if (!audioManager.bgmPlaying && !musicMuted) {
          audioManager.playBgm(audioManager.landingBgmVolume);
        }
      }).catch(() => {});

      // Non-critical assets (BGM ~1.5MB) warm up in background idle time
      preloadNonCriticalResources();
    });
    return unbind;
  }, [musicMuted]);

  // Fallback: unlock audio on first user touch/click if browser blocked autoplay on auto-dismiss
  useEffect(() => {
    const handleFirstInteraction = () => {
      void audioManager.unlock().then(() => {
        if (!audioManager.bgmPlaying && !musicMuted && view !== "game") {
          audioManager.playBgm(audioManager.landingBgmVolume);
        }
      }).catch(() => {});
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("click", handleFirstInteraction);
    };

    window.addEventListener("pointerdown", handleFirstInteraction, { passive: true });
    window.addEventListener("touchstart", handleFirstInteraction, { passive: true });
    window.addEventListener("click", handleFirstInteraction, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("click", handleFirstInteraction);
    };
  }, [musicMuted, view]);

  useEffect(() => {
    void refreshPersonalBest().catch(() => {});
  }, [refreshPersonalBest]);

  // Unified bootstrap barrier: Critical Resources + Wink SDK
  useEffect(() => {
    setGameLoadingProgress(20);

    const criticalPromise = preloadCriticalResources((pct) => {
      setGameLoadingProgress(Math.min(95, pct));
    });

    const winkPromise = integration.readyPromise;

    void Promise.allSettled([criticalPromise, winkPromise]).then(() => {
      completeGameLoading();
    });
  }, [integration.readyPromise]);

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
    void refreshLeaderboard().catch(() => {});
    void refreshPersonalBest().catch(() => {});
    setView("landing");
  }, [refreshLeaderboard, refreshPersonalBest]);

  const handleCompleteRound = useCallback(
    (_result: GameResult) => {
      integration.gameplayStop();
    },
    [integration.gameplayStop],
  );

  const handleOpenLeaderboard = useCallback((returnView: LeaderboardReturnView) => {
    void refreshLeaderboard().catch(() => {});
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
          onGameStart={integration.gameplayStart}
          onSaveScore={onGameOver}
          onCompleteRound={handleCompleteRound}
          onHome={handleHome}
          onRefreshLeaderboard={() => {
            void refreshLeaderboard().catch(() => {});
          }}
          leaderboard={leaderboard}
          bestScore={personalBest?.score ?? bestScore}
        />
      </>
    );
  }

  if (view === "leaderboard") {
    return (
      <LeaderboardScreen
        leaderboard={leaderboard}
        bestScore={personalBest?.score ?? bestScore}
        onBack={() => setView(leaderboardReturnView)}
      />
    );
  }

  // Landing page / Start Screen
  return (
    <div style={{ position: "relative", minHeight: "100vh", overflowX: "hidden" }}>
      <IntegrationStatusBanner
        integration={integration}
        operationError={scoreSubmissionError}
      />
      <TopNav
        muted={musicMuted && sfxMuted}
        onToggleMute={() => {
          const next = !(musicMuted && sfxMuted);
          setMusicMuted(next);
          setSfxMuted(next);
        }}
      />
      <HeroSection
        onPlay={handlePlay}
        onOpenLeaderboard={() => handleOpenLeaderboard("landing")}
        bestScore={personalBest?.score ?? bestScore}
      />
    </div>
  );
}
