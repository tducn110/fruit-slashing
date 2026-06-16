import { useState } from "react";
import { TopNav } from "./components/TopNav";
import { HeroSection } from "./components/HeroSection";
import { GamePage } from "./components/GamePage";
import { LoginModal } from "./components/LoginModal";

import { useAuth } from "./lib/AuthContext";
import { useFirebaseStorage } from "./hooks/useFirebaseStorage";

export default function App() {
  const { user, logout: fbLogout } = useAuth();
  const { bestScore, lastScore, leaderboard, totalGamesPlayed, onGameOver, refreshLeaderboard } = useFirebaseStorage();

  const [view, setView] = useState<"landing" | "game">("landing");
  const [showLogin, setShowLogin] = useState(false);
  const [muted, setMuted] = useState(false);

  // Game view — full screen, dashboard panel opens on demand inside GamePage
  if (view === "game") {
    return (
      <GamePage
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        user={user}
        bestScore={bestScore}
        lastScore={lastScore}
        totalGamesPlayed={totalGamesPlayed}
        leaderboard={leaderboard}
        onGameOver={onGameOver}
        onHome={() => { setView("landing"); refreshLeaderboard(); }}
        onRefreshLeaderboard={refreshLeaderboard}
      />
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
      <TopNav
        onLogin={() => setShowLogin(true)}
        user={userDisplay}
        onLogout={fbLogout}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
      />

      <HeroSection onPlay={() => setView("game")} />

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
