import { useState, useRef, useEffect } from "react";
import { type Container } from "pixi.js";

export function useGameFeedback() {
  const [flashRed, setFlashRed] = useState(false);
  const [bombTexts, setBombTexts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [pointTexts, setPointTexts] = useState<
    Array<{ id: number; x: number; y: number; text: string; color: string }>
  >([]);

  const effectIdRef = useRef(0);
  const shakeRef = useRef({ active: false, startedAt: 0 });
  const timersRef = useRef<Set<number>>(new Set());

  function schedule(cb: () => void, delayMs: number) {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      cb();
    }, delayMs);
    timersRef.current.add(timer);
  }

  function triggerBombFeedback(screen: { x: number; y: number }) {
    shakeRef.current = { active: true, startedAt: performance.now() };
    setFlashRed(true);
    schedule(() => setFlashRed(false), 100);
    const id = ++effectIdRef.current;
    setBombTexts((items) => [...items.slice(-4), { ...screen, id }]);
    schedule(() => {
      setBombTexts((items) => items.filter((item) => item.id !== id));
    }, 800);
  }

  function triggerPointFeedback(input: { x: number; y: number; text: string; color: string }) {
    const id = ++effectIdRef.current;
    setPointTexts((items) => [...items.slice(-8), { ...input, id }]);
    schedule(() => {
      setPointTexts((items) => items.filter((item) => item.id !== id));
    }, 800);
  }

  function updateScreenShake(playLayer: Container | null) {
    if (!shakeRef.current.active || !playLayer) return;
    const elapsed = (performance.now() - shakeRef.current.startedAt) / 400;
    if (elapsed >= 1) {
      shakeRef.current.active = false;
      playLayer.position.set(0, 0);
    } else {
      const amount = 8 * (1 - elapsed);
      playLayer.position.set((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }
  }

  function clearFeedback() {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current.clear();
    setFlashRed(false);
    setBombTexts([]);
    setPointTexts([]);
    shakeRef.current = { active: false, startedAt: 0 };
  }

  useEffect(() => {
    return () => {
      clearFeedback();
    };
  }, []);

  return {
    flashRed,
    bombTexts,
    pointTexts,
    triggerBombFeedback,
    triggerPointFeedback,
    updateScreenShake,
    clearFeedback,
  };
}
