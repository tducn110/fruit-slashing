import { HeroBackdrop } from "./HeroBackdrop";
import { HeroPeanutAnimation } from "./HeroPeanutAnimation";

interface Props {
  onPlay: () => void;
}

export function HeroSection({ onPlay }: Props) {
  return (
    <section
      id="gioi-thieu"
      style={{
        position: "relative",
        minHeight: "100vh",
        paddingTop: 80,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      <HeroBackdrop />
      <HeroPeanutAnimation />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(245,236,215,0.2) 0%, rgba(245,236,215,0.0) 30%, rgba(245,236,215,0.55) 100%)",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "relative",
        maxWidth: 1100,
        padding: "60px 32px",
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 28,
        textAlign: "center",
        zIndex: 2,
      }}>
        <div className="hero-badge" style={{
          display: "inline-block",
          margin: "0 auto",
          padding: "6px 16px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.7)",
          border: "1.5px solid #8a7d65",
          fontSize: 12,
          fontWeight: 700,
          color: "#8e4e22",
          letterSpacing: 1.5,
        }}>
          MINI GAME · BỘ LẠC ĐẬU PHỘNG
        </div>

        <h1 className="hero-title" style={{
          fontSize: "clamp(40px, 7vw, 84px)",
          fontWeight: 800,
          lineHeight: 1.05,
          color: "#2a2418",
          margin: 0,
          fontFamily: "Be Vietnam Pro, sans-serif",
          textShadow: "0 2px 0 rgba(255,255,255,0.6)",
        }}>
          Chém Lạc <span style={{ color: "#e87432" }}>Vùng Cao</span>
        </h1>

        <p className="hero-desc" style={{
          fontSize: "clamp(15px, 1.6vw, 19px)",
          color: "#4a4232",
          maxWidth: 640,
          margin: "0 auto",
          lineHeight: 1.65,
        }}>
          Chém đậu phộng, dừa, chuối, thanh long và khế bay lên giữa
          cánh đồng làng quê. Coi chừng quả bom — một nhát thôi là Lạc Lạc
          giận đó!
        </p>

        <div className="hero-cta" style={{ display: "flex", gap: 32, justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginTop: 20 }}>
          <button onClick={onPlay} style={{
            padding: "16px 36px", borderRadius: 999,
            background: "linear-gradient(180deg,#f08a48,#e87432)",
            color: "#fff", border: "3px solid #b85a22",
            fontWeight: 800, fontSize: 17, cursor: "pointer",
            boxShadow: "0 10px 24px rgba(232,116,50,0.4)",
            fontFamily: "Be Vietnam Pro, sans-serif",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 14px 32px rgba(232,116,50,0.5)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 10px 24px rgba(232,116,50,0.4)";
          }}
          >
            ▶  Chơi ngay
          </button>

        </div>
      </div>
    </section>
  );
}
