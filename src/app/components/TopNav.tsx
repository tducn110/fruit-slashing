import { Volume2, VolumeX } from "lucide-react";

interface Props {
  active: string;
  onNav: (id: string) => void;
  onLogin: () => void;
  user: { name: string; photoURL?: string | null } | null;
  onLogout: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

const SECTIONS = [
  { id: "gioi-thieu", label: "Giới thiệu" },
  { id: "bang-diem", label: "Bảng điểm" },
];

export function TopNav({ active, onNav, onLogin, user, onLogout, muted, onToggleMute }: Props) {
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
      <button
        onClick={() => onNav("gioi-thieu")}
        style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer" }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: "radial-gradient(circle at 30% 30%, #f8c860, #d99820)",
          border: "2px solid #2a2418",
          display: "grid", placeItems: "center",
          color: "#2a2418", fontWeight: 800,
        }}>L</div>
        <span style={{ fontWeight: 800, color: "#2a2418", letterSpacing: 0.3 }}>
          Bộ Lạc Đậu Phộng
        </span>
      </button>

      {/* Section dots (progress) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {SECTIONS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onNav(s.id)}
            title={s.label}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "transparent", border: "none", cursor: "pointer",
              padding: "6px 10px", borderRadius: 999,
              color: active === s.id ? "#e87432" : "#6b6149",
              fontWeight: active === s.id ? 700 : 500,
              fontSize: 13,
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: active === s.id ? "#e87432" : "#c8bfa6",
              transition: "all .25s",
            }} />
            <span className="navLabel">{s.label}</span>
          </button>
        ))}
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
        <div style={{
          padding: "6px 12px", borderRadius: 999,
          border: "1.5px solid #8a7d65", color: "#2a2418",
          fontSize: 12, fontWeight: 700,
        }}>VIE</div>
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.name} referrerPolicy="no-referrer"
                style={{ width: 30, height: 30, borderRadius: "50%", border: "1.5px solid #c8bfa6", objectFit: "cover" }}
              />
            ) : (
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "radial-gradient(circle at 30% 30%, #f8c860, #d99820)",
                border: "1.5px solid #c8bfa6",
                display: "grid", placeItems: "center",
                fontWeight: 800, fontSize: 12, color: "#2a2418",
              }}>{user.name.charAt(0).toUpperCase()}</div>
            )}
            <span style={{ fontSize: 13, color: "#2a2418", fontWeight: 600 }}>
              {user.name}
            </span>
            <button onClick={onLogout} style={pillBtn("ghost")}>Thoát</button>
          </div>
        ) : (
          <button onClick={onLogin} style={pillBtn("solid")}>Đăng nhập</button>
        )}
      </div>

      <style>{`
        @media (max-width: 880px) { .navLabel { display: none; } }
      `}</style>
    </nav>
  );
}

function pillBtn(variant: "solid" | "ghost"): React.CSSProperties {
  return variant === "solid"
    ? {
        padding: "8px 18px", borderRadius: 999,
        background: "linear-gradient(180deg,#f08a48,#e87432)",
        color: "#fff", border: "2px solid #b85a22",
        fontWeight: 700, fontSize: 13, cursor: "pointer",
        boxShadow: "0 4px 12px rgba(232,116,50,0.35)",
      }
    : {
        padding: "8px 14px", borderRadius: 999,
        background: "transparent", color: "#2a2418",
        border: "1.5px solid #8a7d65",
        fontWeight: 700, fontSize: 13, cursor: "pointer",
      };
}
