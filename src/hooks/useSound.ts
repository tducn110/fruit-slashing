import { useCallback, useEffect, useRef } from "react";
import { audioManager } from "../utils/audio-manager";

/**
 * Game sound hook — quản lý BGM + SFX cho toàn bộ game.
 * BGM tự động phát khi gọi playBgm (sau user gesture).
 * SFX slice/bomb dùng polyphonic Web Audio API.
 *
 * Usage:
 *   const { playBgm, stopBgm, playSlice, playBomb } = useGameSound(sfxMuted);
 */
export function useGameSound(sfxMuted: boolean) {
  const bgmStartedRef = useRef(false);

  // Sync gameplay SFX mute state to audio manager.
  useEffect(() => {
    audioManager.setSfxMuted(sfxMuted);
  }, [sfxMuted]);

  const playBgm = useCallback(() => {
    if (bgmStartedRef.current) return;
    bgmStartedRef.current = true;
    audioManager.playBgm(audioManager.landingBgmVolume);
  }, []);

  const stopBgm = useCallback(() => {
    bgmStartedRef.current = false;
    audioManager.stopBgm();
  }, []);

  const playSlice = useCallback(() => {
    audioManager.playSfx("slice", 0.86, 5);
  }, []);

  const playBomb = useCallback(() => {
    audioManager.playSfx("bomb", 0.96, 3);
  }, []);

  return { playBgm, stopBgm, playSlice, playBomb };
}
