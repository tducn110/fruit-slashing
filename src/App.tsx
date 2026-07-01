import { useState, useCallback, useEffect, useRef } from "react";
import { TopNav } from "./components/ui/TopNav";
import { HeroSection } from "./components/ui/HeroSection";
import { GamePage } from "./components/game/GamePage";
import { LoadingScreen } from "./components/ui/LoadingScreen";
import { LoginModal } from "./components/ui/LoginModal";
import { audioManager } from "./utils/audio-manager";
import { preloadGameResources } from "./utils/game-loader";

import { useAuth } from "./contexts/AuthContext";
import { useScoreData } from "./hooks/useScoreData";

type AppView = "loading" | "landing" | "game";

export default function App() {
  const { user, logout: fbLogout } = useAuth();
  const {
    bestScore,
    lastScore,
    leaderboard,
    totalGamesPlayed,
    saveError,
    savingScore,
    onGameOver,
    refreshLeaderboard,
  } = useScoreData();

  const [view, setView] = useState<AppView>("loading");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [resourcesReady, setResourcesReady] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [muted, setMuted] = useState(false);
  // Controls the exit transition of the loading screen
  const [loadingExiting, setLoadingExiting] = useState(false);
  const loadingDoneTimerRef = useRef<number | null>(null);

  // Sync mute state to audio manager.
  useEffect(() => {
    audioManager.setMuted(muted);
  }, [muted]);

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

  // Loading view — waits for all resources
  if (view === "loading") {
    return (
      <LoadingScreen
        progress={resourcesReady ? 100 : loadingProgress}
        onDone={handleLoadingDone}
        completeDelayMs={1150}
        exiting={loadingExiting}
      />
    );
  }

  // Game view — full screen, dashboard panel opens on demand inside GamePage
  if (view === "game") {
    return (
      <>
        <GamePage
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          user={user}
          bestScore={bestScore}
          lastScore={lastScore}
          totalGamesPlayed={totalGamesPlayed}
          leaderboard={leaderboard}
          saveError={saveError}
          savingScore={savingScore}
          onGameOver={onGameOver}
          onHome={handleHome}
          onRefreshLeaderboard={refreshLeaderboard}
          onLoginPrompt={() => setShowLogin(true)}
        />
        <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
      </>
    );
  }

  // Landing view — just nav + hero, no dashboard/footer sections
  const userDisplay = user ? { name: user.displayName ?? "Người chơi", photoURL: user.photoURL } : null;

  return (
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
        onLogin={() => setShowLogin(true)}
        user={userDisplay}
        onLogout={fbLogout}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
      />

      <HeroSection onPlay={handlePlay} />

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
