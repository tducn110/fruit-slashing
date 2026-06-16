import { useCallback, useEffect, useState } from "react";
import { FruitGame } from "./FruitGame";
import { Home, Settings, Trophy, Volume2, VolumeX, X } from "lucide-react";
import type { User } from "firebase/auth";
import type { ScoreRecord } from "../../lib/firebase";

interface Props {
  muted: boolean;
  onToggleMute: () => void;
  user: User | null;
  bestScore: number;
  lastScore: number | null;
  totalGamesPlayed: number;
  leaderboard: ScoreRecord[];
  onGameOver: (score: number) => void;
  onHome: () => void;
  onRefreshLeaderboard: () => void;
  onLoginPrompt: () => void;
}

function rankFor(s: number) {
  if (s >= 400) return "Vua Chém 👑";
  if (s >= 250) return "Cao Thủ ⚔️";
  if (s >= 100) return "Lính Mới 🌱";
  return "Tập Sự 🌾";
}

export function GamePage({
  muted,
  onToggleMute,
  user,
  bestScore,
  lastScore,
  totalGamesPlayed,
  leaderboard,
  onGameOver,
  onHome,
  onRefreshLeaderboard,
  onLoginPrompt,
}: Props) {
  const [panel, setPanel] = useState<null | "settings" | "dashboard">(null);

  // Refresh leaderboard when dashboard opens
  useEffect(() => {
    if (panel === "dashboard") onRefreshLeaderboard();
  }, [panel, onRefreshLeaderboard]);

  // Auto-open dashboard on game over
  const handleGameOver = useCallback((score: number) => {
    onGameOver(score);
    setPanel("dashboard");
  }, [onGameOver]);

  const toggle = (p: "settings" | "dashboard") =>
    setPanel((prev) => (prev === p ? null : p));

  const btnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6,
    padding: "8px 16px", borderRadius: 999,
    border: "2px solid rgba(138,125,101,0.45)",
    background: "rgba(255,255,255,0.88)",
    color: "#2a2418", fontWeight: 700, fontSize: 13,
    cursor: "pointer", backdropFilter: "blur(6px)",
    fontFamily: "Be Vietnam Pro, sans-serif",
    boxShadow: "0 2px 8px rgba(42,36,24,0.12)",
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#f5ecd7",
      display: "flex", flexDirection: "column",
      zIndex: 100,
    }}>
      {/* Top bar */}
      <div className="gameTopBar" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px",
        background: "rgba(245,236,215,0.92)",
        borderBottom: "1.5px solid rgba(138,125,101,0.25)",
        backdropFilter: "blur(8px)",
        zIndex: 10,
        flexShrink: 0,
      }}>
        {/* Left: home */}
        <button onClick={onHome} className="game-btn" style={btnStyle}>
          <Home size={15} /> <span className="btnLabel">Trang chủ</span>
        </button>

        {/* Center: title */}
        <span className="gameTitle" style={{
          fontWeight: 800, fontSize: 16, color: "#2a2418",
          fontFamily: "Be Vietnam Pro, sans-serif",
          letterSpacing: 0.5,
        }}>
          Chém Lạc <span className="gameSub" style={{ color: "#e87432" }}>Vùng Cao</span>
        </span>

        {/* Right: Settings + Dashboard */}
        <div className="gameActions" style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => toggle("dashboard")}
            className="game-btn"
            style={{ ...btnStyle, ...(panel === "dashboard" ? { background: "rgba(232,116,50,0.12)", borderColor: "#e87432" } : {}) }}
          >
            <Trophy size={15} /> <span className="btnLabel">Bảng điểm</span>
          </button>
          <button
            onClick={() => toggle("settings")}
            className="game-btn"
            style={{ ...btnStyle, ...(panel === "settings" ? { background: "rgba(232,116,50,0.12)", borderColor: "#e87432" } : {}) }}
          >
            <Settings size={15} /> Cài đặt
          </button>
        </div>
      </div>

      {/* Game canvas — fills remaining space */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <FruitGame onGameOver={handleGameOver} muted={muted} />

        {/* Settings overlay */}
        {panel === "settings" && (
          <div style={{
            position: "absolute", top: 12, right: 12,
            background: "rgba(255,255,255,0.96)",
            border: "1.5px solid rgba(138,125,101,0.35)",
            borderRadius: 16,
            padding: "20px 24px",
            width: 240,
            boxShadow: "0 12px 32px rgba(42,36,24,0.2)",
            fontFamily: "Be Vietnam Pro, sans-serif",
            zIndex: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>⚙️ Cài đặt</span>
              <button onClick={() => setPanel(null)} className="game-btn-close">
                <X size={16} />
              </button>
            </div>

            {/* Mute toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 14, color: "#4a4232" }}>Âm thanh</span>
              <button
                onClick={onToggleMute}
                className="game-btn"
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 999,
                  background: muted ? "#efe3c4" : "linear-gradient(180deg,#f08a48,#e87432)",
                  color: muted ? "#8a7d65" : "#fff",
                  border: muted ? "1.5px solid #c8bfa6" : "1.5px solid #b85a22",
                  fontWeight: 700, fontSize: 13, cursor: "pointer",
                }}
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                {muted ? "Bật" : "Tắt"}
              </button>
            </div>

            {/* Stats */}
            <div style={{ borderTop: "1px solid #e8dfc8", paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: "#8a7d65", fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>THỐNG KÊ</div>
              <Row label="Điểm cao nhất" value={bestScore || "—"} />
              <Row label="Điểm gần nhất" value={lastScore ?? "—"} />
              <Row label="Tổng lượt chơi" value={totalGamesPlayed} />
              <Row label="Cấp bậc" value={rankFor(bestScore)} />
            </div>

            {!user && (
              <p style={{ fontSize: 12, color: "#8a7d65", marginTop: 14, lineHeight: 1.5 }}>
                💡 Đăng nhập để lưu điểm vào bảng vinh danh.
              </p>
            )}
          </div>
        )}

        {/* Dashboard overlay */}
        {panel === "dashboard" && (
          <div style={{
            position: "absolute", top: 12, right: 12,
            background: "rgba(255,255,255,0.97)",
            border: "1.5px solid rgba(138,125,101,0.35)",
            borderRadius: 16,
            padding: "20px 24px",
            width: 340,
            maxHeight: "80vh",
            overflowY: "auto",
            boxShadow: "0 12px 32px rgba(42,36,24,0.2)",
            fontFamily: "Be Vietnam Pro, sans-serif",
            zIndex: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>🏆 Bảng vinh danh toàn cầu</span>
              <button onClick={() => setPanel(null)} className="game-btn-close">
                <X size={16} />
              </button>
            </div>

            {leaderboard.length === 0 ? (
              <p style={{ fontSize: 13, color: "#8a7d65", textAlign: "center", padding: "20px 0" }}>
                Chưa có điểm nào. Hãy là người đầu tiên!
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: "#8a7d65", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {["#", "Tên", "Điểm", "Thời gian"].map((h) => (
                      <th key={h} style={{ padding: "4px 6px", textAlign: "left", fontWeight: 700, borderBottom: "1.5px solid #ede3cc" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((r, i) => {
                    const isMe = user?.uid === r.uid;
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);
                    return (
                      <tr key={`${r.uid}-${r.createdAt}`} style={{
                        background: isMe ? "rgba(232,116,50,0.08)" : i % 2 === 0 ? "rgba(245,236,215,0.5)" : "transparent",
                      }}>
                        <td style={{ padding: "7px 6px", fontWeight: 700 }}>{medal}</td>
                        <td style={{ padding: "7px 6px", fontWeight: isMe ? 800 : 500, color: isMe ? "#e87432" : "#2a2418" }}>
                          {r.playerName}{isMe ? " (bạn)" : ""}
                        </td>
                        <td style={{ padding: "7px 6px", fontWeight: 700, color: "#e87432" }}>{r.score}</td>
                        <td style={{ padding: "7px 6px", color: "#8a7d65", fontSize: 11 }}>
                          {new Date(r.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Login prompt for guest users */}
            {!user && (
              <button
                onClick={onLoginPrompt}
                className="game-btn loginPromptBtn"
                style={{
                  marginTop: 16, padding: "14px 16px",
                  borderRadius: 14, width: "100%",
                  background: "linear-gradient(135deg, rgba(248,200,96,0.15), rgba(232,116,50,0.1))",
                  border: "1.5px dashed rgba(232,116,50,0.3)",
                  textAlign: "center", cursor: "pointer",
                }}
              >
                <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#e87432", fontSize: 14 }}>
                  🔐 Đăng nhập để lưu điểm!
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#8a7d65", lineHeight: 1.5 }}>
                  Điểm của bạn sẽ được lưu vào bảng vinh danh và không bị mất khi thoát game.
                </p>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: "#6b6149" }}>{label}</span>
      <span style={{ fontWeight: 700, color: "#2a2418" }}>{value}</span>
    </div>
  );
}

/* ── Mobile responsive styles ───────────────────────────────────── */
const mobileStyles = `
@media (max-width: 640px) {
  .gameTopBar {
    flex-wrap: nowrap !important;
    padding: 8px 10px !important;
    gap: 6px !important;
  }
  .gameTopBar .game-btn {
    padding: 6px 10px !important;
    font-size: 11px !important;
    gap: 4px !important;
  }
  .btnLabel { display: none !important; }
  .gameTitle  { font-size: 13px !important; }
  .gameSub { font-size: 13px !important; }
  .gameActions { gap: 4px !important; }
}
.loginPromptBtn:hover p:first-child { text-decoration: underline; }
.loginPromptBtn:hover { border-color: rgba(232,116,50,0.6) !important; background: rgba(248,200,96,0.2) !important; }
`;
document.head.insertAdjacentHTML("beforeend", `<style>${mobileStyles}</style>`);
