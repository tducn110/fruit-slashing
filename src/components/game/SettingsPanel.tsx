import { Volume2, VolumeX, X } from "lucide-react";
import type { User } from "firebase/auth";

export function rankFor(s: number) {
  if (s >= 400) return "Vua Chém 👑";
  if (s >= 250) return "Cao Thủ ⚔️";
  if (s >= 100) return "Lính Mới 🌱";
  return "Tập Sự 🌾";
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: "color-mix(in srgb, var(--ink-dark) 70%, transparent)" }}>{label}</span>
      <span style={{ fontWeight: 700, color: "var(--ink-dark)" }}>{value}</span>
    </div>
  );
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
    <div style={{
      position: "absolute", top: 12, right: 12,
      background: "rgba(255,255,255,0.96)",
      border: "1.5px solid var(--border)",
      borderRadius: 16,
      padding: "20px 24px",
      width: 240,
      boxShadow: "0 12px 32px rgba(42,36,24,0.2)",
      fontFamily: "var(--font-family)",
      zIndex: 20,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>⚙️ Cài đặt</span>
        <button onClick={onClose} className="game-btn-close">
          <X size={16} />
        </button>
      </div>

      {/* Mute toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--ink-dark) 85%, transparent)" }}>Âm thanh</span>
        <button
          onClick={onToggleMute}
          className="game-btn"
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
        </button>
      </div>

      {/* Stats */}
      <div style={{ borderTop: "1px solid var(--muted)", paddingTop: 14 }}>
        <div style={{ fontSize: 12, color: "var(--pencil-gray)", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>THỐNG KÊ</div>
        <Row label="Điểm cao nhất" value={bestScore || "—"} />
        <Row label="Điểm gần nhất" value={lastScore ?? "—"} />
        <Row label="Tổng lượt chơi" value={totalGamesPlayed} />
        <Row label="Cấp bậc" value={rankFor(bestScore)} />
      </div>

      {!user && (
        <p style={{ fontSize: 12, color: "var(--pencil-gray)", marginTop: 14, lineHeight: 1.5 }}>
          💡 Đăng nhập để lưu điểm vào bảng vinh danh.
        </p>
      )}
    </div>
  );
}
