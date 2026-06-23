/**
 * useGameFeedback — Manages bomb flash, screen shake, and floating text feedback.
 *
 * Performance notes (Phase 2.5):
 * - triggerPointFeedback() previously called setPointTexts() immediately on
 *   every slice.  When slicing multiple fruits in the same frame (e.g. a combo),
 *   this caused one React re-render per fruit + one per combo label = 4–6 renders
 *   in a single animation frame.
 * - Batching: pending point-text entries are queued in pendingPointTextsRef and
 *   flushed in a single setState() via queueMicrotask().  Multiple
 *   triggerPointFeedback() calls in the same *synchronous burst* produce exactly
 *   one state update.  Note: queueMicrotask batches same-turn calls, not
 *   necessarily all calls in the same animation frame — if calls arrive across
 *   different async turns they may produce separate flushes.
 * - timersRef tracks all scheduled timeouts for safe cleanup on unmount.
 * - Bomb feedback (low frequency, once per bomb) is not batched — keeps code simple.
 * - No visual or gameplay changes; all CSS/timer behaviour preserved.
 */
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

  // ── Batching state ────────────────────────────────────────────────────────

  /** Queue of point-text entries waiting to be flushed in a single setState. */
  const pendingPointTextsRef = useRef<
    Array<{ id: number; x: number; y: number; text: string; color: string; variant?: "points" | "combo" | "critical" }>
  >([]);
  /** True while a microtask flush is already scheduled. */
  const flushScheduledRef = useRef(false);

  function flushPendingPointTexts() {
    flushScheduledRef.current = false;
    if (!mountedRef.current) return;
    const pending = pendingPointTextsRef.current;
    if (pending.length === 0) return;
    pendingPointTextsRef.current = [];
    setPointTexts((items) => [...items.slice(-14), ...pending]);
  }

  // ── Screen-shake helpers ──────────────────────────────────────────────────

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
      if (!mountedRef.current) return;
      cb();
    }, delayMs);
    timersRef.current.add(timer);
    return timer;
  }

  // ── Bomb feedback (not batched — low frequency) ───────────────────────────

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

  // ── Point feedback (batched) ──────────────────────────────────────────────

  function triggerPointFeedback(input: { x: number; y: number; text: string; color: string; variant?: "points" | "combo" | "critical" }) {
    const id = ++effectIdRef.current;

    // Queue the new entry.
    pendingPointTextsRef.current.push({ ...input, id });

    // Schedule a single flush via microtask if not already scheduled.
    // Multiple synchronous calls in the same frame will share this one flush.
    if (!flushScheduledRef.current) {
      flushScheduledRef.current = true;
      queueMicrotask(flushPendingPointTexts);
    }

    // Schedule cleanup timer for this specific id.
    schedule(() => {
      setPointTexts((items) => items.filter((item) => item.id !== id));
    }, 800);
  }

  // ── Screen shake update (called from Pixi ticker) ─────────────────────────

  function updateScreenShake(playLayer: Container | null) {
    if (!playLayer) return;

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

  // ── Batch clear ───────────────────────────────────────────────────────────

  function clearFeedback() {
    clearTimers();
    resetScreenShake();
    shakenLayerRef.current = null;
    setFlashRed(false);
    setBombTexts([]);
    setPointTexts([]);
    pendingPointTextsRef.current = [];
    flushScheduledRef.current = false;
    shakeRef.current = { active: false, startedAt: 0 };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

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
