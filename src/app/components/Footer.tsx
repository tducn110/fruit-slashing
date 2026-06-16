export function Footer() {
  return (
    <footer id="lien-he" style={{
      padding: "80px 24px 40px",
      background: "linear-gradient(180deg, #efe3c4 0%, #e6d8b2 100%)",
      borderTop: "1px dashed rgba(138,125,101,0.4)",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr",
          gap: 40,
          marginBottom: 50,
        }} className="footGrid">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%",
                background: "radial-gradient(circle at 30% 30%, #f8c860, #d99820)",
                border: "2px solid #2a2418",
                display: "grid", placeItems: "center",
                fontWeight: 800, color: "#2a2418",
              }}>L</div>
              <strong style={{ color: "#2a2418", fontSize: 18 }}>Bộ Lạc Đậu Phộng</strong>
            </div>
            <p style={{ color: "#6b6149", lineHeight: 1.65, fontSize: 14, maxWidth: 360 }}>
              Cảm ơn các chiến hữu, các bạn sẽ luôn là mảnh ghép lớn trong các chuyến đi của Bộ Lạc Đậu Phộng.
            </p>
            <div style={{
              display: "inline-block", marginTop: 14,
              padding: "10px 16px", borderRadius: 12,
              background: "#fff", border: "1.5px dashed #e87432",
              color: "#e87432", fontWeight: 700, fontSize: 14,
            }}>
              bolacdauphong@papagroup.net
            </div>
          </div>

          <div>
            <h4 style={{ color: "#2a2418", margin: "0 0 14px" }}>Điều hướng</h4>
            <ul style={listStyle}>
              <li><a href="#gioi-thieu" style={linkStyle}>Giới thiệu</a></li>
              <li><a href="#choi-game" style={linkStyle}>Chơi game</a></li>
              <li><a href="#bang-diem" style={linkStyle}>Bảng điểm</a></li>
              <li><a href="#nhan-vat" style={linkStyle}>Nhân vật</a></li>
            </ul>
          </div>

          <div>
            <h4 style={{ color: "#2a2418", margin: "0 0 14px" }}>Tải ứng dụng</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <StoreBadge label="App Store" sub="Tải về cho" />
              <StoreBadge label="Google Play" sub="Có sẵn trên" />
            </div>
          </div>
        </div>

        <div style={{
          paddingTop: 24, borderTop: "1px dashed rgba(138,125,101,0.4)",
          display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
          color: "#8a7d65", fontSize: 12,
        }}>
          <span>© 2026 Bộ Lạc Đậu Phộng — Một mini game web phỏng theo phong cách bolacdauphong.vn</span>
          <span>Sản phẩm thuộc về PapaStudio</span>
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) { .footGrid { grid-template-columns: 1fr !important; } }
      `}</style>
    </footer>
  );
}

const listStyle: React.CSSProperties = { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 };
const linkStyle: React.CSSProperties = { color: "#4a4232", textDecoration: "none", fontSize: 14, fontWeight: 500 };

function StoreBadge({ label, sub }: { label: string; sub: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 16px", borderRadius: 12,
      background: "#2a2418", color: "#fff",
      cursor: "pointer",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: "#f0b840",
        display: "grid", placeItems: "center",
        color: "#2a2418", fontWeight: 800,
      }}>▶</div>
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontSize: 10, opacity: 0.7 }}>{sub}</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
      </div>
    </div>
  );
}
