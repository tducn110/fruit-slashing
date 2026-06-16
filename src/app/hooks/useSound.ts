import { useCallback, useRef } from "react";

/**
 * Sound effect hook (design.md §3.4).
 * Placeholder — audio files should be placed in /public/audio/ and loaded here.
 *
 * Usage:
 *   const { playClick, playHover } = useSound(muted);
 *   <button onClick={() => { playClick(); ... }} />
 */
export function useSound(muted: boolean) {
  const clickRef = useRef<HTMLAudioElement | null>(null);
  const hoverRef = useRef<HTMLAudioElement | null>(null);

  /** Play a short UI click sfx. Skips if muted or audio not loaded. */
  const playClick = useCallback(() => {
    if (muted) return;
    try {
      if (!clickRef.current) {
        clickRef.current = new Audio("/audio/click.mp3");
        clickRef.current.volume = 0.5;
      }
      clickRef.current.currentTime = 0;
      clickRef.current.play().catch(() => {});
    } catch {}
  }, [muted]);

  /** Play a short UI hover sfx. */
  const playHover = useCallback(() => {
    if (muted) return;
    try {
      if (!hoverRef.current) {
        hoverRef.current = new Audio("/audio/hover.mp3");
        hoverRef.current.volume = 0.3;
      }
      hoverRef.current.currentTime = 0;
      hoverRef.current.play().catch(() => {});
    } catch {}
  }, [muted]);

  return { playClick, playHover };
}
