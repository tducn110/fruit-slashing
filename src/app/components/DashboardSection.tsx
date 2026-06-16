import { Trophy, Flame, Target, Award } from "lucide-react";

import { DASHBOARD_CONTENT, type Run } from "../config/content";

interface Props {
  user: { name: string } | null;
  lastScore: number | null;
  bestScore: number;
  totalGamesPlayed: number;
  history: Run[];
}

export function DashboardSection({ user, lastScore, bestScore, totalGamesPlayed, history }: Props) {
  // Only use real Firebase data — no mock fallback
  const board = [
    ...(user && bestScore > 0
      ? [{ id: "me", player: user.name, score: bestScore, date: "Bạn", combo: 0 }]
      : []),
    ...history,
  ].sort((a, b) => b.score - a.score).slice(0, 8);

  return (
    <section id="bang-diem" style={{
      padding: "100px 24px",
      background: "linear-gradient(180deg, #f5ecd7 0%, #efe3c4 100%)",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Header />

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}>
          <StatCard icon={<Trophy size={22} />} label="Điểm cao nhất" value={bestScore || "—"} accent="#e87432" />
          <StatCard icon={<Target size={22} />} label="Điểm gần nhất" value={lastScore ?? "—"} accent="#6b8e3d" />
          <StatCard icon={<Flame size={22} />} label="Tổng lượt chơi" value={totalGamesPlayed} accent="#c23838" />
          <StatCard icon={<Award size={22} />} label="Cấp bậc" value={rankFor(bestScore)} accent="#8e4e22" />
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 24,
        }} className="dashGrid">
          <Card title="🏆  Bảng vinh danh">
            {board.length === 0 ? (
              <Empty msg="Chưa có ai chơi. Hãy là người đầu tiên lập kỷ lục!" />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#8a7d65", fontSize: 12, textAlign: "left" }}>
                    <th style={th}>#</th><th style={th}>Tên</th><th style={th}>Điểm</th><th style={th}>Combo</th><th style={th}>Lúc</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((r, i) => (
                    <tr key={r.id} style={{
                      background: r.player === user?.name ? "rgba(232,116,50,0.08)" : "transparent",
                      borderTop: "1px dashed rgba(138,125,101,0.3)",
                    }}>
                      <td style={td}>
                        <span style={{
                          display: "inline-grid", placeItems: "center",
                          width: 26, height: 26, borderRadius: "50%",
                          background: i === 0 ? "#f0b840" : i === 1 ? "#d0c4a0" : i === 2 ? "#d99258" : "#efe3c4",
                          color: "#2a2418", fontWeight: 800, fontSize: 13,
                        }}>{i + 1}</span>
                      </td>
                      <td style={{ ...td, fontWeight: 700, color: "#2a2418" }}>{r.player}</td>
                      <td style={{ ...td, fontWeight: 800, color: "#e87432" }}>{r.score}</td>
                      <td style={td}>{r.combo > 0 ? `×${r.combo}` : "—"}</td>
                      <td style={{ ...td, color: "#8a7d65", fontSize: 12 }}>{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="📜  Lịch sử của bạn">
            {!user ? (
              <Empty msg={DASHBOARD_CONTENT.emptyHistoryGuest} />
            ) : history.length === 0 ? (
              <Empty msg={DASHBOARD_CONTENT.emptyHistoryUser} />
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                {history.slice(0, 6).map(r => (
                  <li key={r.id} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 12,
                    background: "rgba(255,255,255,0.6)",
                    border: "1px dashed rgba(138,125,101,0.4)",
                  }}>
                    <span style={{ color: "#8a7d65", fontSize: 13 }}>{r.date}</span>
                    <span style={{ fontWeight: 800, color: "#e87432" }}>{r.score} đ</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .dashGrid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

const th: React.CSSProperties = { padding: "10px 8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 };
const td: React.CSSProperties = { padding: "12px 8px", color: "#4a4232", fontSize: 14 };

function Header() {
  return (
    <div style={{ textAlign: "center", marginBottom: 36 }}>
      <div style={{
        display: "inline-block", padding: "5px 14px", borderRadius: 999,
        background: "rgba(232,116,50,0.12)", color: "#e87432",
        fontSize: 12, fontWeight: 700, letterSpacing: 1.5, marginBottom: 12,
      }}>{DASHBOARD_CONTENT.tag}</div>
      <h2 style={{
        fontSize: "clamp(28px, 4vw, 44px)",
        fontWeight: 800, color: "#2a2418", margin: "0 0 10px",
      }}>{DASHBOARD_CONTENT.title}</h2>
      <p style={{ color: "#6b6149", maxWidth: 520, margin: "0 auto" }}>
        {DASHBOARD_CONTENT.desc}
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.85)",
      borderRadius: 20,
      padding: 24,
      border: "1.5px solid rgba(138,125,101,0.3)",
      boxShadow: "0 8px 24px rgba(42,36,24,0.06)",
    }}>
      <h3 style={{ margin: "0 0 16px", color: "#2a2418", fontWeight: 800, fontSize: 18 }}>{title}</h3>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; accent: string }) {
  return (
    <div style={{
      padding: 20, borderRadius: 18,
      background: "rgba(255,255,255,0.85)",
      border: "1.5px solid rgba(138,125,101,0.3)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: accent }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 700, color: "#8a7d65", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: "#2a2418" }}>{value}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ padding: 30, textAlign: "center", color: "#8a7d65", fontStyle: "italic" }}>{msg}</div>;
}

function rankFor(s: number) {
  if (s >= 400) return "Bậc thầy";
  if (s >= 250) return "Cao thủ";
  if (s >= 120) return "Lão luyện";
  if (s >= 40)  return "Khá khen";
  if (s > 0)    return "Tập tành";
  return "—";
}
