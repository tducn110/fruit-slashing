import { useState, useCallback, useEffect, useRef } from "react";
import { TopNav } from "./components/ui/TopNav";
import { HeroSection } from "./components/ui/HeroSection";
import { GamePage } from "./components/game/GamePage";
import { LeaderboardScreen } from "./components/game/DashboardPanel";
import { LoadingScreen } from "./components/ui/LoadingScreen";
import { audioManager } from "./utils/audio-manager";
import { preloadGameResources } from "./utils/game-loader";

import { useScoreData } from "./hooks/useScoreData";
import { IntegrationStatusBanner } from "./components/ui/IntegrationStatusBanner";
import { useWinkIntegration } from "./integrations/wink/useWinkIntegration";
import type { GameResult } from "./game/types";

type AppView = "loading" | "landing" | "game" | "leaderboard";
type LeaderboardReturnView = "landing" | "game";

export default function App() {
  const integration = useWinkIntegration();
  const {
    bestScore,
    leaderboard,
    onGameOver,
    refreshLeaderboard,
    error: scoreError,
  } = useScoreData(integration);

  const [view, setView] = useState<AppView>("loading");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [resourcesReady, setResourcesReady] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [leaderboardReturnView, setLeaderboardReturnView] = useState<LeaderboardReturnView>("game");
  // Controls the exit transition of the loading screen
  const [loadingExiting, setLoadingExiting] = useState(false);
  const loadingDoneTimerRef = useRef<number | null>(null);

  // Sync mute state to audio manager.
  useEffect(() => {
    audioManager.setMusicMuted(musicMuted);
  }, [musicMuted]);

  useEffect(() => {
    audioManager.setSfxMuted(sfxMuted);
  }, [sfxMuted]);

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

  // Bootstrap once: audio decoding, web fonts and a Pixi renderer preflight.
  useEffect(() => {
    let active = true;
    void preloadGameResources((progress) => {
      if (active) setLoadingProgress(progress);
    }).then(() => {
      if (active) setResourcesReady(true);
    }).catch((error) => {
      console.error("Game resource preload failed", error);
    });
    return () => { active = false; };
  }, []);

  // When loading finishes, start exit transition then go to landing
  const handleLoadingDone = useCallback(() => {
    setLoadingExiting(true);

    if (loadingDoneTimerRef.current !== null) {
      window.clearTimeout(loadingDoneTimerRef.current);
    }

    loadingDoneTimerRef.current = window.setTimeout(() => {
      setView("landing");
      setLoadingExiting(false);
      loadingDoneTimerRef.current = null;
    }, 850);
  }, []);

  useEffect(() => {
    return () => {
      if (loadingDoneTimerRef.current !== null) {
        window.clearTimeout(loadingDoneTimerRef.current);
      }
    };
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
    refreshLeaderboard();
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
    refreshLeaderboard();
    setLeaderboardReturnView(returnView);
    setView("leaderboard");
  }, [refreshLeaderboard]);

  // Loading view — waits for all resources
  if (view === "loading") {
    return (
      <>
        <IntegrationStatusBanner
          integration={integration}
          operationError={scoreError}
        />
        <LoadingScreen
          progress={resourcesReady ? 100 : loadingProgress}
          onDone={handleLoadingDone}
          completeDelayMs={1150}
          exiting={loadingExiting}
        />
      </>
    );
  }

  // Game view — full screen, dashboard panel opens on demand inside GamePage
  if (view === "game") {
    return (
      <>
        <IntegrationStatusBanner
          integration={integration}
          operationError={scoreError}
        />
        <GamePage
          musicMuted={musicMuted}
          sfxMuted={sfxMuted}
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
          operationError={scoreError}
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
        operationError={scoreError}
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
