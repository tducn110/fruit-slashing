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
 * - Point feedback also starts a short Pixi-side micro shake. This keeps the
 *   slice impact in the render loop instead of adding extra React state.
 */
import { useState, useRef, useEffect } from "react";
import { type Container } from "pixi.js";

export function useGameFeedback() {
  const [flashRed, setFlashRed] = useState(false);
  const [bombTexts, setBombTexts] = useState<Array<{ id: number; x: number; y: number; expiresAt?: number }>>([]);
  const [pointTexts, setPointTexts] = useState<
    Array<{ id: number; x: number; y: number; text: string; color: string; variant?: "points" | "combo" | "critical"; expiresAt?: number }>
  >([]);

  const effectIdRef = useRef(0);
  const shakeRef = useRef({ active: false, startedAt: 0, durationMs: 400, amount: 8 });
  const timersRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(false);
  const shakenLayerRef = useRef<Container | null>(null);
  const lastPointShakeAtRef = useRef(0);

  // Synchronous tracking refs to decouple scheduler side-effects from React setState updaters
  const activePointTextsRef = useRef<
    Array<{ id: number; x: number; y: number; text: string; color: string; variant?: "points" | "combo" | "critical"; expiresAt?: number }>
  >([]);
  const pointCleanupTimerRef = useRef<number | null>(null);
  const pointCleanupTargetTimeRef = useRef<number | null>(null);

  const activeBombTextsRef = useRef<Array<{ id: number; x: number; y: number; expiresAt?: number }>>([]);
  const bombCleanupTimerRef = useRef<number | null>(null);
  const bombCleanupTargetTimeRef = useRef<number | null>(null);

  // ── Screen-shake helpers ──────────────────────────────────────────────────

  function resetScreenShake(layer?: Container | null) {
    const targetLayer = layer ?? shakenLayerRef.current;
    if (!targetLayer || targetLayer.destroyed || !targetLayer.position) return;
    targetLayer.position.set(0, 0);
  }

  function clearTimers() {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current.clear();
    pointCleanupTimerRef.current = null;
    pointCleanupTargetTimeRef.current = null;
    bombCleanupTimerRef.current = null;
    bombCleanupTargetTimeRef.current = null;
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

  // ── Robust point text cleanup scheduler ───────────────────────────────────

  function schedulePointCleanup(targetTime: number) {
    const now = performance.now();
    if (pointCleanupTimerRef.current !== null && pointCleanupTargetTimeRef.current !== null) {
      if (targetTime >= pointCleanupTargetTimeRef.current) return;
      window.clearTimeout(pointCleanupTimerRef.current);
      timersRef.current.delete(pointCleanupTimerRef.current);
      pointCleanupTimerRef.current = null;
    }

    pointCleanupTargetTimeRef.current = targetTime;
    const delay = Math.max(16, targetTime - now);
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      pointCleanupTimerRef.current = null;
      pointCleanupTargetTimeRef.current = null;
      cleanupPointTexts();
    }, delay);
    timersRef.current.add(timer);
    pointCleanupTimerRef.current = timer;
  }

  function cleanupPointTexts() {
    if (!mountedRef.current) return;
    const now = performance.now();
    const current = activePointTextsRef.current;
    if (current.length === 0) return;

    const remaining: typeof current = [];
    let hasExpired = false;
    let nextExpiry = Infinity;

    for (let i = 0; i < current.length; i += 1) {
      const item = current[i];
      const expiresAt = item.expiresAt ?? 0;
      if (expiresAt <= now) {
        hasExpired = true;
      } else {
        remaining.push(item);
        if (expiresAt < nextExpiry) {
          nextExpiry = expiresAt;
        }
      }
    }

    if (hasExpired) {
      activePointTextsRef.current = remaining;
      setPointTexts(remaining);
    }

    // Always reschedule if items remain, even if timer woke slightly early
    if (remaining.length > 0 && nextExpiry !== Infinity) {
      schedulePointCleanup(nextExpiry);
    }
  }

  // ── Batching state ────────────────────────────────────────────────────────

  /** Queue of point-text entries waiting to be flushed in a single setState. */
  const pendingPointTextsRef = useRef<
    Array<{ id: number; x: number; y: number; text: string; color: string; variant?: "points" | "combo" | "critical"; expiresAt?: number }>
  >([]);
  /** True while a microtask flush is already scheduled. */
  const flushScheduledRef = useRef(false);

  function flushPendingPointTexts() {
    flushScheduledRef.current = false;
    if (!mountedRef.current) return;
    const pending = pendingPointTextsRef.current;
    if (pending.length === 0) return;
    pendingPointTextsRef.current = [];

    const nextItems = [...activePointTextsRef.current, ...pending].slice(-15);
    activePointTextsRef.current = nextItems;
    setPointTexts(nextItems);

    let earliest = Infinity;
    for (let i = 0; i < nextItems.length; i += 1) {
      const exp = nextItems[i].expiresAt ?? 0;
      if (exp < earliest) earliest = exp;
    }
    if (earliest !== Infinity) {
      schedulePointCleanup(earliest);
    }
  }

  // ── Robust bomb text cleanup scheduler ────────────────────────────────────

  function scheduleBombCleanup(targetTime: number) {
    const now = performance.now();
    if (bombCleanupTimerRef.current !== null && bombCleanupTargetTimeRef.current !== null) {
      if (targetTime >= bombCleanupTargetTimeRef.current) return;
      window.clearTimeout(bombCleanupTimerRef.current);
      timersRef.current.delete(bombCleanupTimerRef.current);
      bombCleanupTimerRef.current = null;
    }

    bombCleanupTargetTimeRef.current = targetTime;
    const delay = Math.max(16, targetTime - now);
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      bombCleanupTimerRef.current = null;
      bombCleanupTargetTimeRef.current = null;
      cleanupBombTexts();
    }, delay);
    timersRef.current.add(timer);
    bombCleanupTimerRef.current = timer;
  }

  function cleanupBombTexts() {
    if (!mountedRef.current) return;
    const now = performance.now();
    const current = activeBombTextsRef.current;
    if (current.length === 0) return;

    const remaining: typeof current = [];
    let hasExpired = false;
    let nextExpiry = Infinity;

    for (let i = 0; i < current.length; i += 1) {
      const item = current[i];
      const expiresAt = item.expiresAt ?? 0;
      if (expiresAt <= now) {
        hasExpired = true;
      } else {
        remaining.push(item);
        if (expiresAt < nextExpiry) {
          nextExpiry = expiresAt;
        }
      }
    }

    if (hasExpired) {
      activeBombTextsRef.current = remaining;
      setBombTexts(remaining);
    }

    if (remaining.length > 0 && nextExpiry !== Infinity) {
      scheduleBombCleanup(nextExpiry);
    }
  }

  // ── Bomb feedback (low frequency) ─────────────────────────────────────────

  function triggerBombFeedback(screen: { x: number; y: number }) {
    shakeRef.current = { active: true, startedAt: performance.now(), durationMs: 420, amount: 11 };
    setFlashRed(true);
    schedule(() => setFlashRed(false), 100);
    const id = ++effectIdRef.current;
    const expiresAt = performance.now() + 800;
    const nextItems = [...activeBombTextsRef.current.slice(-4), { ...screen, id, expiresAt }];
    activeBombTextsRef.current = nextItems;
    setBombTexts(nextItems);
    scheduleBombCleanup(expiresAt);
  }

  // ── Point feedback (batched insert + batched cleanup) ─────────────────────

  function triggerPointFeedback(input: { x: number; y: number; text: string; color: string; variant?: "points" | "combo" | "critical" }) {
    const id = ++effectIdRef.current;
    const amount = input.variant === "critical" ? 5.5 : input.variant === "combo" ? 3.8 : 2.4;
    const durationMs = input.variant === "points" ? 130 : 190;
    const now = performance.now();
    const shouldShake = input.variant !== "points" || now - lastPointShakeAtRef.current > 70;
    if (shouldShake) {
      shakeRef.current = { active: true, startedAt: now, durationMs, amount };
      lastPointShakeAtRef.current = now;
    }

    // Queue the new entry with expiration timestamp.
    const expiresAt = now + 800;
    pendingPointTextsRef.current.push({ ...input, id, expiresAt });

    // Schedule a single flush via microtask if not already scheduled.
    if (!flushScheduledRef.current) {
      flushScheduledRef.current = true;
      queueMicrotask(flushPendingPointTexts);
    }
  }

  // ── Screen shake update (called from Pixi ticker) ─────────────────────────

  function updateScreenShake(playLayer: Container | null) {
    if (!playLayer || playLayer.destroyed) {
      if (shakenLayerRef.current === playLayer) {
        shakenLayerRef.current = null;
      }
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
    const elapsed = (performance.now() - shakeRef.current.startedAt) / shakeRef.current.durationMs;
    if (elapsed >= 1) {
      shakeRef.current.active = false;
      resetScreenShake(playLayer);
      shakenLayerRef.current = null;
    } else {
      const amount = shakeRef.current.amount * Math.pow(1 - elapsed, 2);
      const wave = Math.sin(elapsed * Math.PI * 8);
      playLayer.position.set(
        wave * amount + (Math.random() - 0.5) * amount * 0.55,
        Math.cos(elapsed * Math.PI * 7) * amount * 0.42,
      );
    }
  }

  // ── Batch clear ───────────────────────────────────────────────────────────

  function clearFeedback() {
    clearTimers();
    resetScreenShake();
    shakenLayerRef.current = null;
    setFlashRed(false);
    activeBombTextsRef.current = [];
    activePointTextsRef.current = [];
    setBombTexts([]);
    setPointTexts([]);
    pendingPointTextsRef.current = [];
    flushScheduledRef.current = false;
    lastPointShakeAtRef.current = 0;
    shakeRef.current = { active: false, startedAt: 0, durationMs: 400, amount: 8 };
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
