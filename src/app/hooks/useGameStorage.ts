import { useState, useEffect, useCallback } from "react";
import { type Run } from "../config/content";

export interface User { name: string; }

const LS_USER = "blp_user";
const LS_HISTORY = "blp_history";
const LS_BEST = "blp_best";

export function useGameStorage() {
  const [user, setUser] = useState<User | null>(null);
  const [history, setHistory] = useState<Run[]>([]);
  const [bestScore, setBestScore] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);

  // Load persisted state
  useEffect(() => {
    try {
      const u = localStorage.getItem(LS_USER);
      if (u) setUser(JSON.parse(u));
      const h = localStorage.getItem(LS_HISTORY);
      if (h) setHistory(JSON.parse(h));
      const b = localStorage.getItem(LS_BEST);
      if (b) setBestScore(Number(b) || 0);
    } catch {}
  }, []);

  const login = useCallback((name: string) => {
    const u = { name };
    setUser(u);
    localStorage.setItem(LS_USER, JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(LS_USER);
  }, []);

  const saveRun = useCallback((finalScore: number) => {
    setLastScore(finalScore);
    if (finalScore > bestScore) {
      setBestScore(finalScore);
      localStorage.setItem(LS_BEST, String(finalScore));
    }
    if (user) {
      const run: Run = {
        id: crypto.randomUUID(),
        player: user.name,
        score: finalScore,
        date: new Date().toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }),
        combo: 0,
      };
      const next = [run, ...history].slice(0, 30);
      setHistory(next);
      localStorage.setItem(LS_HISTORY, JSON.stringify(next));
    }
  }, [bestScore, history, user]);

  return {
    user,
    history,
    bestScore,
    lastScore,
    login,
    logout,
    saveRun,
  };
}
