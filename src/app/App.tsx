import { useState, useCallback, useEffect, useRef } from "react";
import { TopNav } from "./components/TopNav";
import { HeroSection } from "./components/HeroSection";
import { GamePage } from "./components/GamePage";
import { LoadingScreen } from "./components/LoadingScreen";
import { LoginModal } from "./components/LoginModal";
import { audioManager } from "./utils/audio-manager";

import { useAuth } from "./lib/AuthContext";
import { useFirebaseStorage } from "./hooks/useFirebaseStorage";

export default function App() {
  const { user, logout: fbLogout } = useAuth();
  const {
    bestScore,
    lastScore,
    leaderboard,
    totalGamesPlayed,
    saveError,
    verifyingScore,
    beginGame,
    onGameOver,
    refreshLeaderboard,
  } = useFirebaseStorage();

  const [view, setView] = useState<"landing" | "loading" | "game">("landing");
  const [showLogin, setShowLogin] = useState(false);
  const [muted, setMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [audioStatus, setAudioStatus] = useState(""); // "Đang tải nhạc..." or ""
  const audioBusyRef = useRef(false); // 🔥 block re-entry
  const loadingTarget = useRef<"game" | "landing">("game");

  // 🎵 Sync mute state to audio manager
  useEffect(() => {
    audioManager.setMuted(muted);
  }, [muted]);

  // 🎵 Preload BGM in background immediately (no user gesture needed for fetch)
  useEffect(() => {
    setAudioStatus("Đang tải nhạc...");
    audioManager.preloadBgmOnly("/assets/").then(() => {
      setAudioStatus("");
    });
  }, []);

  // 🎵 Unlock audio + start BGM on first user tap (browser autoplay policy)
  const handleFirstInteraction = useCallback(async () => {
    if (audioBusyRef.current || audioUnlocked) return;
    audioBusyRef.current = true;
    try {
      await audioManager.unlock();
      // BGM buffer already loaded by useEffect above — play instantly
      audioManager.playBgm(0.7);
      setAudioUnlocked(true);
    } catch {
      // Failed — allow retry
    } finally {
      audioBusyRef.current = false;
    }
  }, [audioUnlocked]);

  // Khi user nhấn "Chơi ngay" → loading rồi vào game
  const handlePlay = useCallback(async () => {
    await audioManager.unlock();
    loadingTarget.current = "game";
    setView("loading");
  }, []);

  // Khi về trang chủ → loading rồi về landing
  const handleHome = useCallback(() => {
    audioManager.stopBgm();
    loadingTarget.current = "landing";
    refreshLeaderboard();
    setView("loading");
  }, [refreshLeaderboard]);

  // Khi loading xong → vào game hoặc landing, điều chỉnh âm lượng BGM
  const handleLoaded = useCallback(() => {
    if (loadingTarget.current === "game") {
      audioManager.setBgmVolume(0.2);  // Nhỏ lại để nghe rõ SFX chém
    } else {
      // Về trang chủ: bật lại BGM nếu chưa phát
      if (!audioManager.bgmPlaying) {
        audioManager.playBgm(0.7);
      } else {
        audioManager.setBgmVolume(0.7);
      }
    }
    setView(loadingTarget.current);
  }, []);

  // Loading view — hiển thị khi chuyển game hoặc về trang chủ
  if (view === "loading") {
    return (
      <LoadingScreen
        onLoaded={handleLoaded}
        startBgm={loadingTarget.current === "game"}
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
          verifyingScore={verifyingScore}
          onGameStart={beginGame}
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
      style={{
        minHeight: "100vh",
        background: "#f5ecd7",
        fontFamily: "'Be Vietnam Pro', sans-serif",
        color: "#2a2418",
      }}
    >
      {/* 🎵 Tap-to-start overlay — unlocks audio on first interaction */}
      {!audioUnlocked && (
        <div
          onClick={handleFirstInteraction}
          style={{
            position: "fixed", inset: 0,
            zIndex: 99999,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(245,236,215,0.92)",
            backdropFilter: "blur(8px)",
            cursor: "pointer",
            userSelect: "none",
            fontFamily: "'Be Vietnam Pro', sans-serif",
          }}
        >
          <div style={{
            fontSize: 48,
            marginBottom: 16,
            animation: "pulse 1.5s ease-in-out infinite",
          }}>
            🎵
          </div>
          <div style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#2a2418",
            textAlign: "center",
            textShadow: "0 1px 0 rgba(255,255,255,0.6)",
            marginBottom: 8,
          }}>
            {audioStatus || "Chạm vào màn hình để bắt đầu"}
          </div>
          <div style={{
            fontSize: 13,
            color: "#8a7d65",
            textAlign: "center",
          }}>
            {audioStatus ? "(Vui lòng đợi...)" : "(Yêu cầu để mở nhạc nền)"}
          </div>
          <style>{`
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.15); opacity: 0.7; }
            }
          `}</style>
        </div>
      )}

      <TopNav
        onLogin={() => setShowLogin(true)}
        user={userDisplay}
        onLogout={fbLogout}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
      />

      <HeroSection onPlay={handlePlay} />

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />

      <style>{`
        html { scroll-behavior: smooth; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: #efe3c4; }
        ::-webkit-scrollbar-thumb { background: #c8bfa6; border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: #a89c80; }
      `}</style>
    </div>
  );
}
