import { useState, useRef, useEffect } from "react";
import { type Container } from "pixi.js";

export function useGameFeedback() {
  const [flashRed, setFlashRed] = useState(false);
  const [bombTexts, setBombTexts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [pointTexts, setPointTexts] = useState<
    Array<{ id: number; x: number; y: number; text: string; color: string; variant?: "points" | "combo" | "critical" }>
  >([]);

  const effectIdRef = useRef(0);
  const shakeRef = useRef({ active: false, startedAt: 0 });
  const timersRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(false);
  const shakenLayerRef = useRef<Container | null>(null);

  function resetScreenShake(layer?: Container | null) {
    const targetLayer = layer ?? shakenLayerRef.current;
    if (!targetLayer) return;
    targetLayer.position.set(0, 0);
  }

  function clearTimers() {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current.clear();
  }

  function schedule(cb: () => void, delayMs: number) {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      if (!mountedRef.current) {
        return;
      }
      cb();
    }, delayMs);
    timersRef.current.add(timer);
    return timer;
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

  function triggerPointFeedback(input: { x: number; y: number; text: string; color: string; variant?: "points" | "combo" | "critical" }) {
    const id = ++effectIdRef.current;
    setPointTexts((items) => [...items.slice(-14), { ...input, id }]);
    schedule(() => {
      setPointTexts((items) => items.filter((item) => item.id !== id));
    }, 800);
  }

  function updateScreenShake(playLayer: Container | null) {
    if (!playLayer) {
      return;
    }

    if (!shakeRef.current.active) {
      if (shakenLayerRef.current === playLayer) {
        resetScreenShake(playLayer);
        shakenLayerRef.current = null;
      }
      return;
    }

    shakenLayerRef.current = playLayer;
    const elapsed = (performance.now() - shakeRef.current.startedAt) / 400;
    if (elapsed >= 1) {
      shakeRef.current.active = false;
      resetScreenShake(playLayer);
      shakenLayerRef.current = null;
    } else {
      const amount = 8 * (1 - elapsed);
      playLayer.position.set((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }
  }

  function clearFeedback() {
    clearTimers();
    resetScreenShake();
    shakenLayerRef.current = null;
    setFlashRed(false);
    setBombTexts([]);
    setPointTexts([]);
    shakeRef.current = { active: false, startedAt: 0 };
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
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
