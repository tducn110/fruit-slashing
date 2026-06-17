import { HeroBackdrop } from "./HeroBackdrop";

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
        <div style={{
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

        <h1 style={{
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

        <p style={{
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

        <div style={{ display: "flex", gap: 32, justifyContent: "center", alignItems: "center", flexWrap: "wrap", marginTop: 20 }}>
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

          <div style={{ animation: "mascotBounce 2.5s infinite ease-in-out" }}>
            <svg width="90" height="100" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Bóng */}
              <ellipse cx="50" cy="115" rx="30" ry="5" fill="rgba(42,36,24,0.1)"/>
              {/* Thân củ lạc (2 vòng tròn gộp lại) */}
              <path d="M50 10 C20 10, 25 50, 40 60 C20 70, 20 110, 50 110 C80 110, 80 70, 60 60 C75 50, 80 10, 50 10 Z" fill="#f0b840" stroke="#8e4e22" strokeWidth="4" strokeLinejoin="round"/>
              {/* Vân ngang */}
              <path d="M35 25 Q50 30 65 25 M30 85 Q50 90 70 85 M35 95 Q50 100 65 95" stroke="#8e4e22" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
              {/* Tay vẫy */}
              <path d="M25 65 Q5 40 15 25" stroke="#8e4e22" strokeWidth="4" strokeLinecap="round" fill="none" style={{ animation: "waveLeft 1s infinite alternate ease-in-out", transformOrigin: "25px 65px" }} />
              <path d="M75 65 Q95 60 85 85" stroke="#8e4e22" strokeWidth="4" strokeLinecap="round" fill="none" />
              {/* Mắt */}
              <circle cx="38" cy="45" r="4.5" fill="#2a2418"/>
              <circle cx="62" cy="45" r="4.5" fill="#2a2418"/>
              {/* Má hồng */}
              <ellipse cx="28" cy="50" rx="6" ry="3.5" fill="#e87432" opacity="0.5"/>
              <ellipse cx="72" cy="50" rx="6" ry="3.5" fill="#e87432" opacity="0.5"/>
              {/* Miệng cười */}
              <path d="M45 52 Q50 62 55 52" stroke="#2a2418" strokeWidth="3" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
        </div>

        <style>{`
          @keyframes mascotBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }
          @keyframes waveLeft {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(15deg); }
          }
        `}</style>
      </div>
    </section>
  );
}
