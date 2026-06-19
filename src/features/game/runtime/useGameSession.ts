import { useState, useEffect, useRef } from "react";
import type { GameResult } from "../../../game/types";

interface UseGameSessionOptions {
  onGameOver?: (result: GameResult) => void;
  onStart?: () => void;
}

export function useGameSession({ onGameOver, onStart }: UseGameSessionOptions) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const playingRef = useRef(false);
  const startedAtRef = useRef(0);
  const submittedRef = useRef(false);

  function startCountdown() {
    if (starting || running) return;
    setCountdown(3);
  }

  function startSession() {
    setStarting(true);
    try {
      submittedRef.current = false;
      startedAtRef.current = performance.now();
      playingRef.current = true;
      setFinalScore(null);
      setRunning(true);
      setCountdown(null);
    } finally {
      setStarting(false);
    }
  }

  function finishGame(result: GameResult) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    playingRef.current = false;
    setRunning(false);
    setFinalScore(result.score);
    onGameOver?.(result);
  }

  function resetSession() {
    setRunning(false);
    setFinalScore(null);
    startCountdown();
  }

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => {
      if (countdown === 1) {
        onStart?.();
      } else {
        setCountdown(countdown - 1);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [countdown, onStart]);

  // Initial countdown trigger
  useEffect(() => {
    if (!running && finalScore === null && countdown === null) {
      startCountdown();
    }
  }, []);

  return {
    countdown,
    running,
    starting,
    finalScore,
    playingRef,
    startedAtRef,
    submittedRef,
    startCountdown,
    startSession,
    finishGame,
    resetSession,
  };
}
