import { Assets, type Spritesheet } from "pixi.js";
import { audioManager } from "./audio-manager";

let criticalPreloadPromise: Promise<void> | null = null;

async function preloadFont(): Promise<void> {
  if (!("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load('400 16px "Be Vietnam Pro"'),
      document.fonts.load('700 16px "Be Vietnam Pro"'),
      document.fonts.load('800 16px "Be Vietnam Pro"'),
    ]);
    await document.fonts.ready;
  } catch {}
}

async function preloadLandingSpritesheet(): Promise<void> {
  try {
    await Assets.load<Spritesheet>("/assets/peanut_idle_wave_spritesheet.json");
  } catch (err) {
    console.warn("[GameLoader] Failed to pre-cache peanut spritesheet in Pixi Assets", err);
  }
}

/**
 * Preload strictly CRITICAL resources required for the initial scene (Landing / Start Screen).
 * BGM and non-critical items are deferred to idle time to guarantee instant transition.
 */
export function preloadCriticalResources(onProgress?: (pct: number) => void): Promise<void> {
  if (criticalPreloadPromise) return criticalPreloadPromise;

  criticalPreloadPromise = (async () => {
    onProgress?.(25);

    // Phase 1: Fonts & First Scene Pixi Spritesheet
    await Promise.allSettled([preloadFont(), preloadLandingSpritesheet()]);
    onProgress?.(65);

    // Phase 2: Core Gameplay SFX (slice, bomb)
    await audioManager.preloadEssentialAudio("/assets/").catch(() => {});
    onProgress?.(95);
  })()
    .then(() => undefined)
    .catch((error) => {
      criticalPreloadPromise = null;
      throw error;
    });

  return criticalPreloadPromise;
}

/** Legacy alias for backward compatibility */
export const preloadGameResources = preloadCriticalResources;

/**
 * Preload NON-CRITICAL assets (heavy BGM ~1.5MB, decorative items) in browser idle time
 * AFTER player has already entered the Start Screen.
 */
export function preloadNonCriticalResources(): void {
  if (typeof window === "undefined") return;

  const loadBgm = () => {
    void audioManager.preloadBgm("/assets/").catch(() => {});
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(loadBgm, { timeout: 4000 });
  } else {
    window.setTimeout(loadBgm, 1200);
  }
}
