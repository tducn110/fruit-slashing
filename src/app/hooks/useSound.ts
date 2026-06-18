import { useCallback, useEffect, useRef } from "react";
import { audioManager } from "../utils/audio-manager";

/**
 * Game sound hook — quản lý BGM + SFX cho toàn bộ game.
 * BGM tự động phát khi gọi playBgm (sau user gesture).
 * SFX slice/bomb dùng polyphonic Web Audio API.
 *
 * Usage:
 *   const { playBgm, stopBgm, playSlice, playBomb } = useGameSound(muted);
 */
export function useGameSound(muted: boolean) {
  const bgmStartedRef = useRef(false);

  // Sync mute state to audio manager
  useEffect(() => {
    audioManager.setMuted(muted);
  }, [muted]);

  const playBgm = useCallback(() => {
    if (bgmStartedRef.current) return;
    bgmStartedRef.current = true;
    audioManager.playBgm(0.7);
  }, []);

  const stopBgm = useCallback(() => {
    bgmStartedRef.current = false;
    audioManager.stopBgm();
  }, []);

  const playSlice = useCallback(() => {
    audioManager.playSfx("slice", 0.55, 5);
  }, []);

  const playBomb = useCallback(() => {
    audioManager.playSfx("bomb", 0.7, 3);
  }, []);

  return { playBgm, stopBgm, playSlice, playBomb };
}
