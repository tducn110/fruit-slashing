import { useState, useRef, useEffect } from "react";
import { type Container } from "pixi.js";

/**
 * Point labels are inserted and expired only by the once-per-ticker flush.
 *
 * WHY NOT setTimeout: the old design used setTimeout to batch and expire labels.
 * That caused one React re-render per sliced fruit (4–6 renders per frame on combos)
 * and a race where pausing the game left orphaned timers still firing state updates.
 * flushFeedback() is called by the Pixi ticker every frame, so insertion, expiry,
 * and dedup happen in a single synchronous pass with one setState per frame at most.
 * Do not move point-text scheduling back to setTimeout without re-solving both problems.
 */
export function useGameFeedback({ maxPointTexts = 15 }: { maxPointTexts?: number } = {}) {
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

  const pendingPointTextsRef = useRef<typeof activePointTextsRef.current>([]);

  // The game ticker is the sole scheduler: expiry and insertion share one commit.
  // While paused, labels are hidden with the game and pruned on its next frame.
  function flushFeedback() {
    if (!mountedRef.current) return;
    const now = performance.now();
    const active = activePointTextsRef.current;
    const pending = pendingPointTextsRef.current;
    const limit = Math.max(0, Math.floor(maxPointTexts));
    const expired = active.some(item => (item.expiresAt ?? 0) <= now);
    if (!expired && pending.length === 0 && active.length <= limit) return;
    const nextItems = [...active, ...pending].filter(item => (item.expiresAt ?? 0) > now);
    if (nextItems.length > limit) nextItems.splice(0, nextItems.length - limit);
    pending.length = 0;
    activePointTextsRef.current = nextItems;
    setPointTexts(nextItems);
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

    // Bound pending work even if input arrives while the ticker is suspended.
    const limit = Math.max(0, Math.floor(maxPointTexts));
    if (pendingPointTextsRef.current.length > limit) {
      pendingPointTextsRef.current.splice(0, pendingPointTextsRef.current.length - limit);
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
    flushFeedback,
    updateScreenShake,
    clearFeedback,
  };
}
