import { BarChart3, Music, Settings as SettingsIcon, Trophy, UserRound, Volume2, VolumeX } from "lucide-react";
import type React from "react";
import { PanelFrame, IconButton } from "../ui/primitives";
import { getRank } from "../../lib/localScores";

interface Props {
  muted: boolean;
  onToggleMute: () => void;
  bestScore: number;
  lastScore: number | null;
  totalGamesPlayed: number;
  onClose: () => void;
}

export function SettingsPanel({
  muted,
  onToggleMute,
  bestScore,
  lastScore,
  totalGamesPlayed,
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
            {muted ? <VolumeX size={20} /> : <Music size={20} />}
            <span>Âm thanh</span>
          </div>
          <IconButton
            label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
            aria-pressed={!muted}
            variant="solid"
            onClick={onToggleMute}
            className={`settingsToggle ${muted ? "is-off" : "is-on"}`}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {muted ? "Bật" : "Tắt"}
          </IconButton>
        </div>

        <div className="settingsStatsCard">
          <div className="settingsSectionLabel">
            <BarChart3 size={15} />
            Thống kê
          </div>
          <StatLine icon={<Trophy size={16} />} label="Điểm cao nhất" value={bestScore || "—"} />
          <StatLine icon={<BarChart3 size={16} />} label="Điểm gần nhất" value={lastScore ?? "—"} />
          <StatLine icon={<UserRound size={16} />} label="Tổng lượt chơi" value={totalGamesPlayed} />
          <StatLine icon={<Trophy size={16} />} label="Cấp bậc" value={getRank(bestScore)} strong />
        </div>
      </div>
    </PanelFrame>
  );
}

function StatLine({
  icon,
  label,
  value,
  strong = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="settingsStatLine">
      <span className="settingsStatLabel">
        {icon}
        {label}
      </span>
      <span className={strong ? "settingsStatValue is-strong" : "settingsStatValue"}>
        {value}
      </span>
    </div>
  );
}
