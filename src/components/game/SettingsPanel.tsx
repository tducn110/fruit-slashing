import { Volume2, VolumeX } from "lucide-react";
import type { User } from "firebase/auth";
import { PanelFrame, IconButton, StatRow } from "../ui/primitives";

export function rankFor(s: number) {
  if (s >= 400) return "Vua Chém 👑";
  if (s >= 250) return "Cao Thủ ⚔️";
  if (s >= 100) return "Lính Mới 🌱";
  return "Tập Sự 🌾";
}

interface Props {
  muted: boolean;
  onToggleMute: () => void;
  bestScore: number;
  lastScore: number | null;
  totalGamesPlayed: number;
  user: User | null;
  onClose: () => void;
}

export function SettingsPanel({
  muted,
  onToggleMute,
  bestScore,
  lastScore,
  totalGamesPlayed,
  user,
  onClose,
}: Props) {
  return (
    <PanelFrame
      title="⚙️ Cài đặt"
      width={240}
      onClose={onClose}
    >

      {/* Mute toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--ink-dark) 85%, transparent)" }}>Âm thanh</span>
        <IconButton
          label="Mute Toggle"
          variant="solid"
          onClick={onToggleMute}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 999,
            background: muted ? "var(--paper-warm)" : "linear-gradient(180deg, color-mix(in srgb, var(--primary) 80%, white), var(--primary))",
            color: muted ? "var(--pencil-gray)" : "#fff",
            border: muted ? "1.5px solid var(--secondary-container)" : "1.5px solid color-mix(in srgb, var(--primary) 70%, black)",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          {muted ? "Bật" : "Tắt"}
        </IconButton>
      </div>

      {/* Stats */}
      <div style={{ borderTop: "1px solid var(--muted)", paddingTop: 14 }}>
        <div style={{ fontSize: 12, color: "var(--pencil-gray)", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>THỐNG KÊ</div>
        <StatRow label="Điểm cao nhất" value={bestScore || "—"} />
        <StatRow label="Điểm gần nhất" value={lastScore ?? "—"} />
        <StatRow label="Tổng lượt chơi" value={totalGamesPlayed} />
        <StatRow label="Cấp bậc" value={rankFor(bestScore)} />
      </div>

      {!user && (
        <p style={{ fontSize: 12, color: "var(--pencil-gray)", marginTop: 14, lineHeight: 1.5 }}>
          💡 Đăng nhập để lưu điểm vào bảng vinh danh.
        </p>
      )}
    </PanelFrame>
  );
}
