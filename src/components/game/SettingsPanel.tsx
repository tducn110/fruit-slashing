import { Globe, Music2, Settings as SettingsIcon, Sparkles, Volume2, VolumeX } from "lucide-react";
import { PanelFrame, IconButton } from "../ui/primitives";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n";

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
  const { t } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage?.startsWith("en") ? "en" : "vi";
  const nextLanguage = currentLanguage === "vi" ? "en" : "vi";

  return (
    <PanelFrame
      title={(
        <span className="settingsPanelTitle">
          <SettingsIcon size={20} /> {t("game.settings", "Settings")}
        </span>
      )}
      width={330}
      onClose={onClose}
      className="settingsPanel"
    >
      <div className="settingsPanelRows">
            <div className="settingsOptionRow">
              <div className="settingsOptionLabel">
                <Globe size={20} />
                <span>{t("game.language", "Language")}</span>
              </div>
              <IconButton
                label={t("game.toggle_language", "Toggle language")}
                variant="solid"
                onClick={() => void i18n.changeLanguage(nextLanguage)}
                className="settingsToggle is-on"
              >
                {nextLanguage.toUpperCase()}
              </IconButton>
            </div>
            <div className="settingsOptionRow">
              <div className="settingsOptionLabel">
                {musicMuted ? <VolumeX size={20} /> : <Music2 size={20} />}
                <span>{t("game.music", "Music")}</span>
              </div>
              <IconButton
                label={musicMuted ? t("game.unmute_bgm", "Unmute background music") : t("game.mute_bgm", "Mute background music")}
                aria-pressed={!musicMuted}
                variant="solid"
                onClick={onToggleMusic}
                className={`settingsToggle ${musicMuted ? "is-off" : "is-on"}`}
              >
                {musicMuted ? <VolumeX size={14} /> : <Music2 size={14} />}
                {musicMuted ? t("game.on", "On") : t("game.off", "Off")}
              </IconButton>
            </div>
            <div className="settingsOptionRow">
              <div className="settingsOptionLabel">
                {sfxMuted ? <VolumeX size={20} /> : <Sparkles size={20} />}
                <span>{t("game.sfx", "SFX")}</span>
              </div>
              <IconButton
                label={sfxMuted ? t("game.unmute_sfx", "Unmute sound effects") : t("game.mute_sfx", "Mute sound effects")}
                aria-pressed={!sfxMuted}
                variant="solid"
                onClick={onToggleSfx}
                className={`settingsToggle ${sfxMuted ? "is-off" : "is-on"}`}
              >
                {sfxMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                {sfxMuted ? t("game.on", "On") : t("game.off", "Off")}
              </IconButton>
            </div>
      </div>
    </PanelFrame>
  );
}
