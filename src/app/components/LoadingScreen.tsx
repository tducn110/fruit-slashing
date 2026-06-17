import { useEffect, useState, useRef, useCallback } from "react";
import { audioManager } from "../utils/audio-manager";

interface Props {
  onLoaded: () => void;
  startBgm?: boolean;
}

/**
 * LoadingScreen — hiển thị progress bar khi tải assets.
 * Tải audio buffers qua AudioManager, sau đó tự động gọi onLoaded.
 */
export function LoadingScreen({ onLoaded, startBgm = true }: Props) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Đang khởi tạo...");
  const startedRef = useRef(false);

  const doLoad = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (audioManager.loaded) {
      // Already loaded — quick transition
      setProgress(100);
      setStatus("Sẵn sàng!");
      if (startBgm && !audioManager.bgmPlaying) {
        audioManager.playBgm(0.7);
      }
      await new Promise((r) => setTimeout(r, 400));
      onLoaded();
      return;
    }

    setStatus("Đang tải âm thanh...");

    // Unlock AudioContext (cần user gesture trước đó)
    try {
      await audioManager.unlock();
    } catch {
      // Continue anyway
    }

    await audioManager.preloadAll("/assets/", (ratio) => {
      setProgress(Math.round(ratio * 100));
    });

    // 🎵 BGM only if requested (game = yes, landing = no)
    if (startBgm && !audioManager.bgmPlaying) {
      audioManager.playBgm(0.7);
    }

    setProgress(100);
    setStatus("Sẵn sàng!");

    // Brief pause so user sees 100%
    await new Promise((r) => setTimeout(r, 500));
    onLoaded();
  }, [onLoaded, startBgm]);

  useEffect(() => {
    doLoad();
  }, [doLoad]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "linear-gradient(180deg, #f5ecd7 0%, #efe3c4 50%, #e6d8b2 100%)",
      fontFamily: "'Be Vietnam Pro', sans-serif",
      zIndex: 9999,
      userSelect: "none",
    }}>
      {/* Decorative background */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 30%, rgba(232,116,50,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo / Title */}
      <div style={{
        marginBottom: 48,
        textAlign: "center",
        zIndex: 1,
      }}>
        <div style={{
          fontSize: 48,
          fontWeight: 800,
          color: "#e87432",
          letterSpacing: 2,
          textShadow: "0 2px 8px rgba(232,116,50,0.25)",
          lineHeight: 1,
        }}>
          ⚔️ Chém Lạc
        </div>
        <div style={{
          fontSize: 16,
          color: "#8a7d65",
          marginTop: 8,
          letterSpacing: 4,
          fontWeight: 600,
        }}>
          VÙNG CAO
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: "min(320px, 80vw)",
        zIndex: 1,
      }}>
        {/* Bar track */}
        <div style={{
          width: "100%",
          height: 10,
          borderRadius: 999,
          background: "rgba(42,36,24,0.06)",
          overflow: "hidden",
          border: "1.5px solid rgba(138,125,101,0.25)",
        }}>
          <div style={{
            width: `${progress}%`,
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, #e87432, #f0a848, #e87432)",
            backgroundSize: "200% 100%",
            animation: "loadingShimmer 1.5s linear infinite",
            transition: "width 0.3s ease",
            boxShadow: "0 0 8px rgba(232,116,50,0.25)",
          }} />
        </div>

        {/* Percentage */}
        <div style={{
          textAlign: "center",
          marginTop: 14,
          fontSize: 28,
          fontWeight: 800,
          color: "#e87432",
          letterSpacing: 1,
        }}>
          {progress}%
        </div>

        {/* Status text */}
        <div style={{
          textAlign: "center",
          marginTop: 8,
          fontSize: 13,
          color: "#8a7d65",
          fontWeight: 500,
        }}>
          {status}
        </div>
      </div>

      {/* CSS animation for shimmer */}
      <style>{`
        @keyframes loadingShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
