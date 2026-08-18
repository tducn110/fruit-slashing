import { audioManager } from "./audio-manager";

let preloadPromise: Promise<void> | null = null;

async function preloadFont(): Promise<void> {
  if (!("fonts" in document)) return;
  await Promise.all([
    document.fonts.load('400 16px "Be Vietnam Pro"'),
    document.fonts.load('700 16px "Be Vietnam Pro"'),
    document.fonts.load('800 16px "Be Vietnam Pro"'),
  ]);
  await document.fonts.ready;
}

/** Warm up every network/runtime dependency in the background before the first game session. */
export function preloadGameResources(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  preloadPromise = Promise.all([
    audioManager.preloadEssentialAudio("/assets/"),
    preloadFont(),
  ]).then(() => undefined).catch((error) => {
    preloadPromise = null;
    throw error;
  });
  return preloadPromise;
}