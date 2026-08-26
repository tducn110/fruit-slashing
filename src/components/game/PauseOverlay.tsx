import { useTranslation } from "react-i18next";
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
  const { t, i18n } = useTranslation();
  if (!visible) return null;

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('en') ? 'vi' : 'en';
    i18n.changeLanguage(nextLang);
  };

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
            className="pauseHudButton pauseHudButton--lang"
            onClick={toggleLanguage}
            aria-label={t('game.toggle_language', 'Chuyển ngôn ngữ')}
          >
            <span style={{ fontSize: 24, fontWeight: 800, textTransform: "uppercase" }}>
              {i18n.language.startsWith('en') ? 'EN' : 'VI'}
            </span>
          </button>

          <button
            type="button"
            className="pauseHudButton pauseHudButton--reset"
            onClick={onRestart}
            aria-label={t('game.restart', 'Chơi lại')}
          >
            <RotateCcw aria-hidden="true" size={32} />
          </button>

          <button
            type="button"
            className="pauseHudButton pauseHudButton--bgm"
            onClick={onToggleMusic}
            aria-label={musicMuted ? t('game.unmute_bgm', 'Bật nhạc nền') : t('game.mute_bgm', 'Tắt nhạc nền')}
            aria-pressed={!musicMuted}
          >
            <Music2 aria-hidden="true" size={32} />
            {musicMuted && <span className="pauseHudMuteSlash" aria-hidden="true" />}
          </button>

          <button
            type="button"
            className="pauseHudButton pauseHudButton--sfx"
            onClick={onToggleSfx}
            aria-label={sfxMuted ? t('game.unmute_sfx', 'Bật hiệu ứng âm thanh') : t('game.mute_sfx', 'Tắt hiệu ứng âm thanh')}
            aria-pressed={!sfxMuted}
          >
            {sfxMuted ? <VolumeX aria-hidden="true" size={32} /> : <Volume2 aria-hidden="true" size={32} />}
          </button>
        </div>

        <button
          type="button"
          className="pauseHudPlayButton"
          onClick={onResume}
          aria-label={t('game.resume', 'Tiếp tục')}
        >
          <Play aria-hidden="true" size={48} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
