import { useCallback, useEffect, useState } from "react";
import { TopNav } from "./components/TopNav";
import { HeroSection } from "./components/HeroSection";
import { GamePage } from "./components/GamePage";
import { DashboardSection } from "./components/DashboardSection";
import { LoginModal } from "./components/LoginModal";
import { Footer } from "./components/Footer";

import { useAuth } from "./lib/AuthContext";
import { useFirebaseStorage } from "./hooks/useFirebaseStorage";

export default function App() {
  const { user, loading: authLoading, logout: fbLogout } = useAuth();
  const { bestScore, lastScore, leaderboard, totalGamesPlayed, onGameOver, refreshLeaderboard } = useFirebaseStorage();

  const [view, setView] = useState<"landing" | "game">("landing");
  const [active, setActive] = useState("gioi-thieu");
  const [showLogin, setShowLogin] = useState(false);
  const [muted, setMuted] = useState(false);

  // Section scroll tracking (only active on landing)
  useEffect(() => {
    if (view !== "landing") return;
    const ids = ["gioi-thieu", "bang-diem", "nhan-vat", "lien-he"];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { threshold: [0.35, 0.6] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [view]);

  const handleNav = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Game view
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

  // Landing view
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
        active={active}
        onNav={handleNav}
        onLogin={() => setShowLogin(true)}
        user={userDisplay}
        onLogout={fbLogout}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
      />

      <HeroSection onPlay={() => setView("game")} />

      <DashboardSection
        user={userDisplay}
        lastScore={lastScore}
        bestScore={bestScore}
        totalGamesPlayed={totalGamesPlayed}
        history={leaderboard.map((r) => ({
          id: `${r.uid}-${r.createdAt}`,
          player: r.playerName,
          score: r.score,
          date: new Date(r.createdAt).toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
          }),
          combo: 0,
        }))}
      />

      <Footer />

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
