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

async function preloadBrandLogo(): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = "/assets/brand/PapaStudio_Logo_Symbol_Black.png";
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
}

/**
 * Preload ALL resources required for the initial scene (Landing / Start Screen),
 * including fonts, spritesheets, SFX, and BGM during the Papa loading screen.
 */
export function preloadCriticalResources(onProgress?: (pct: number) => void): Promise<void> {
  if (criticalPreloadPromise) return criticalPreloadPromise;

  criticalPreloadPromise = (async () => {
    onProgress?.(15);

    // Phase 1: Fonts, Brand Logo & First Scene Pixi Spritesheet
    await Promise.allSettled([preloadFont(), preloadLandingSpritesheet(), preloadBrandLogo()]);
    onProgress?.(55);

    // Phase 2: All audio required for first screen (SFX + BGM)
    await Promise.allSettled([
      audioManager.preloadEssentialAudio("/assets/"),
      audioManager.preloadBgm("/assets/"),
    ]);
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
 * Secondary non-critical idle preload. All first-screen assets are already loaded in Papa screen.
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
