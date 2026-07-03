import { Volume2, VolumeX } from "lucide-react";

interface Props {
  muted: boolean;
  onToggleMute: () => void;
}

export function TopNav({ muted, onToggleMute }: Props) {
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 28px",
      background: "rgba(245,236,215,0.85)",
      backdropFilter: "blur(10px)",
      borderBottom: "1px solid rgba(138,125,101,0.18)",
      fontFamily: "Be Vietnam Pro, sans-serif",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #f8c860, #d99820)",
          border: "2px solid #2a2418",
          display: "grid", placeItems: "center",
          color: "#2a2418", fontWeight: 800,
        }}>L</div>
        <span className="brandName" style={{ fontWeight: 800, color: "#2a2418", letterSpacing: 0.3 }}>
          Bộ Lạc Đậu Phộng
        </span>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onToggleMute}
          aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "transparent", border: "1.5px solid #8a7d65",
            color: "#2a2418", cursor: "pointer",
            display: "grid", placeItems: "center",
          }}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    </nav>
  );
}
