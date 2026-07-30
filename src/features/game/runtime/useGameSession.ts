import { useState, useEffect, useRef } from "react";
import type { GameResult } from "../../../game/types";

export interface UseGameSessionOptions {
  onGameOver?: (result: GameResult) => void;
  onComplete?: (result: GameResult) => void;
  onStart?: () => void;
}

function createRoundId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  }

  const bytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export function useGameSession({
  onGameOver,
  onComplete,
  onStart,
}: UseGameSessionOptions) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [finalResult, setFinalResult] = useState<GameResult | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);

  const playingRef = useRef(false);
  const startedAtRef = useRef(0);
  const roundIdRef = useRef<string | null>(null);
  const completionSentRef = useRef(false);
  const finishHandledRef = useRef(false);

  function startCountdown() {
    if (starting || running) return;
    setCountdown(3);
  }

  function startSession() {
    if (playingRef.current) return;
    setStarting(true);
    try {
      const nextRoundId = createRoundId();
      roundIdRef.current = nextRoundId;
      setRoundId(nextRoundId);
      completionSentRef.current = false;
      finishHandledRef.current = false;
      startedAtRef.current = performance.now();
      playingRef.current = true;
      setFinalScore(null);
      setFinalResult(null);
      setRunning(true);
      setCountdown(null);
    } finally {
      setStarting(false);
    }
  }

  function finishGame(result: GameResult) {
    if (finishHandledRef.current) return;
    finishHandledRef.current = true;
    const activeRoundId = roundIdRef.current ?? result.roundId;
    const completedResult: GameResult = {
      ...result,
      roundId: activeRoundId,
    };
    playingRef.current = false;
    setRunning(false);
    setFinalScore(completedResult.score);
    setFinalResult(completedResult);
    if (!completionSentRef.current) {
      completionSentRef.current = true;
      try {
        onComplete?.(completedResult);
      } catch {
        // Completion and score delivery are independent operations.
      }
    }
    try {
      onGameOver?.(completedResult);
    } catch {
      // A score callback failure must not undo the completed round state.
    }
  }

  function resetSession() {
    setRunning(false);
    setFinalScore(null);
    setFinalResult(null);
    startCountdown();
  }

  function resumeSession(elapsedMs: number) {
    finishHandledRef.current = false;
    startedAtRef.current = performance.now() - Math.max(0, elapsedMs);
    playingRef.current = true;
    setStarting(false);
    setRunning(true);
    setCountdown(null);
    setFinalScore(null);
    setFinalResult(null);
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
    finalResult,
    roundId,
    playingRef,
    startedAtRef,
    submittedRef: completionSentRef,
    roundIdRef,
    startCountdown,
    startSession,
    finishGame,
    resetSession,
    resumeSession,
  };
}
