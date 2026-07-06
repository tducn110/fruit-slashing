import { Music, Settings as SettingsIcon, Sparkles, Volume2, VolumeX } from "lucide-react";
import { PanelFrame, IconButton } from "../ui/primitives";

interface Props {
  musicMuted: boolean;
  sfxMuted: boolean;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
  onClose: () => void;
}

export function SettingsPanel({
  musicMuted,
  sfxMuted,
  onToggleMusic,
  onToggleSfx,
  onClose,
}: Props) {
  return (
    <PanelFrame
      title={(
        <span className="settingsPanelTitle">
          <SettingsIcon size={20} />
          Cài đặt
        </span>
      )}
      width={330}
      onClose={onClose}
      className="settingsPanel"
    >
      <div className="settingsPanelRows">
        <div className="settingsOptionRow">
          <div className="settingsOptionLabel">
            {musicMuted ? <VolumeX size={20} /> : <Music size={20} />}
            <span>Nhạc nền</span>
          </div>
          <IconButton
            label={musicMuted ? "Bật nhạc nền" : "Tắt nhạc nền"}
            aria-pressed={!musicMuted}
            variant="solid"
            onClick={onToggleMusic}
            className={`settingsToggle ${musicMuted ? "is-off" : "is-on"}`}
          >
            {musicMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {musicMuted ? "Bật" : "Tắt"}
          </IconButton>
        </div>

        <div className="settingsOptionRow">
          <div className="settingsOptionLabel">
            {sfxMuted ? <VolumeX size={20} /> : <Sparkles size={20} />}
            <span>SFX</span>
          </div>
          <IconButton
            label={sfxMuted ? "Bật hiệu ứng âm thanh" : "Tắt hiệu ứng âm thanh"}
            aria-pressed={!sfxMuted}
            variant="solid"
            onClick={onToggleSfx}
            className={`settingsToggle ${sfxMuted ? "is-off" : "is-on"}`}
          >
            {sfxMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {sfxMuted ? "Bật" : "Tắt"}
          </IconButton>
        </div>
      </div>
    </PanelFrame>
  );
}
