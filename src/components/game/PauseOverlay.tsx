import {
  Music2,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";

interface PauseOverlayProps {
  visible: boolean;
  musicMuted: boolean;
  sfxMuted: boolean;
  onResume: () => void;
  onRestart: () => void;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
}

export function PauseOverlay({
  visible,
  musicMuted,
  sfxMuted,
  onResume,
  onRestart,
  onToggleMusic,
  onToggleSfx,
}: PauseOverlayProps) {
  if (!visible) return null;

  return (
    <div className="pauseHudOverlay" role="presentation">
      <div
        className="pauseHudCard"
        role="dialog"
        aria-modal="true"
        aria-label="Menu tạm dừng"
      >
        <div className="pauseHudUtilityRow">
          <button
            type="button"
            className="pauseHudButton pauseHudButton--reset"
            onClick={onRestart}
            aria-label="Chơi lại"
          >
            <RotateCcw aria-hidden="true" size={32} />
          </button>

          <button
            type="button"
            className="pauseHudButton pauseHudButton--bgm"
            onClick={onToggleMusic}
            aria-label={musicMuted ? "Bật nhạc nền" : "Tắt nhạc nền"}
            aria-pressed={!musicMuted}
          >
            <Music2 aria-hidden="true" size={32} />
            {musicMuted && <span className="pauseHudMuteSlash" aria-hidden="true" />}
          </button>

          <button
            type="button"
            className="pauseHudButton pauseHudButton--sfx"
            onClick={onToggleSfx}
            aria-label={sfxMuted ? "Bật hiệu ứng âm thanh" : "Tắt hiệu ứng âm thanh"}
            aria-pressed={!sfxMuted}
          >
            {sfxMuted ? <VolumeX aria-hidden="true" size={32} /> : <Volume2 aria-hidden="true" size={32} />}
          </button>
        </div>

        <button
          type="button"
          className="pauseHudPlayButton"
          onClick={onResume}
          aria-label="Tiếp tục"
        >
          <Play aria-hidden="true" size={48} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
