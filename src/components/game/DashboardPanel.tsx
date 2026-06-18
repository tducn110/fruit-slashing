import { X } from "lucide-react";
import type { User } from "firebase/auth";
import type { ScoreRecord } from "../../lib/firebase";

interface Props {
  leaderboard: ScoreRecord[];
  user: User | null;
  verifyingScore?: boolean;
  saveError?: string | null;
  onLoginPrompt: () => void;
  onClose: () => void;
}

export function DashboardPanel({
  leaderboard,
  user,
  verifyingScore,
  saveError,
  onLoginPrompt,
  onClose,
}: Props) {
  return (
    <div style={{
      position: "absolute", top: 12, right: 12,
      background: "rgba(255,255,255,0.97)",
      border: "1.5px solid var(--border)",
      borderRadius: 16,
      padding: "20px 24px",
      width: 340,
      maxHeight: "80vh",
      overflowY: "auto",
      boxShadow: "0 12px 32px rgba(42,36,24,0.2)",
      fontFamily: "var(--font-family)",
      zIndex: 20,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>🏆 Bảng vinh danh toàn cầu</span>
        <button onClick={onClose} className="game-btn-close">
          <X size={16} />
        </button>
      </div>

      {leaderboard.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--pencil-gray)", textAlign: "center", padding: "20px 0" }}>
          Chưa có điểm nào. Hãy là người đầu tiên!
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--pencil-gray)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {["#", "Tên", "Điểm", "Thời gian"].map((h) => (
                <th key={h} style={{ padding: "4px 6px", textAlign: "left", fontWeight: 700, borderBottom: "1.5px solid var(--paper-warm)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((r, i) => {
              const isMe = user?.uid === r.uid;
              const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);
              return (
                <tr key={`${r.uid}-${r.createdAt}`} style={{
                  background: isMe ? "color-mix(in srgb, var(--primary) 8%, transparent)" : i % 2 === 0 ? "color-mix(in srgb, var(--rice-paper) 50%, transparent)" : "transparent",
                }}>
                  <td style={{ padding: "7px 6px", fontWeight: 700 }}>{medal}</td>
                  <td style={{ padding: "7px 6px", fontWeight: isMe ? 800 : 500, color: isMe ? "var(--primary)" : "var(--ink-dark)" }}>
                    {r.playerName}{isMe ? " (bạn)" : ""}
                  </td>
                  <td style={{ padding: "7px 6px", fontWeight: 700, color: "var(--primary)" }}>{r.score}</td>
                  <td style={{ padding: "7px 6px", color: "var(--pencil-gray)", fontSize: 11 }}>
                    {new Date(r.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {verifyingScore && (
        <p style={{ fontSize: 12, color: "var(--pencil-gray)", marginTop: 12, textAlign: "center" }}>
          Đang lưu điểm và cập nhật bảng điểm…
        </p>
      )}

      {/* Save error banner */}
      {saveError && (
        <div style={{
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 10,
          background: "color-mix(in srgb, var(--destructive) 8%, transparent)",
          border: "1px solid color-mix(in srgb, var(--destructive) 25%, transparent)",
          fontSize: 12,
          color: "var(--destructive)",
          lineHeight: 1.5,
        }}>
          ⚠️ {saveError}
        </div>
      )}

      {/* Login prompt for guest users */}
      {!user && (
        <button
          onClick={onLoginPrompt}
          className="game-btn loginPromptBtn"
          style={{
            marginTop: 16, padding: "14px 16px",
            borderRadius: 14, width: "100%",
            background: "linear-gradient(135deg, color-mix(in srgb, var(--mascot-yellow) 15%, transparent), color-mix(in srgb, var(--primary) 10%, transparent))",
            border: "1.5px dashed color-mix(in srgb, var(--primary) 30%, transparent)",
            textAlign: "center", cursor: "pointer",
          }}
        >
          <p style={{ margin: "0 0 6px", fontWeight: 700, color: "var(--primary)", fontSize: 14 }}>
            🔐 Đăng nhập để lưu điểm!
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--pencil-gray)", lineHeight: 1.5 }}>
            Điểm của bạn sẽ được lưu vào bảng vinh danh và không bị mất khi thoát game.
          </p>
        </button>
      )}
    </div>
  );
}
