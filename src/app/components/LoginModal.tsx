import { useState } from "react";
import { X, Mail, Lock, User } from "lucide-react";
import { useAuth } from "../lib/AuthContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LoginModal({ open, onClose }: Props) {
  const { loginWithGoogle, signUp, signIn, user, error, clearError, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Close when user logs in (user changes from null → object)
  if (user && open) {
    // small delay so success is visible
    setTimeout(() => onClose(), 300);
  }

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signUp(email, pwd, name.trim() || email.split("@")[0] || "Người chơi");
      } else {
        await signIn(email, pwd);
      }
      // onClose will be triggered by the user state change above
    } catch {
      // error is already set in AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const googleLogin = async () => {
    clearError();
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch {
      // error set in context
    } finally {
      setSubmitting(false);
    }
  };

  const btnDisabled = submitting || loading;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(42,36,24,0.55)",
        display: "grid", placeItems: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420,
          background: "#fdf6ea",
          borderRadius: 24,
          border: "1.5px solid rgba(138,125,101,0.4)",
          padding: 32,
          boxShadow: "0 20px 60px rgba(42,36,24,0.3)",
          position: "relative",
          fontFamily: "Be Vietnam Pro, sans-serif",
        }}
      >
        <button type="button" onClick={onClose} className="game-btn-close" style={{
          position: "absolute", top: 14, right: 14,
        }}>
          <X size={18} />
        </button>

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #f8c860, #d99820)",
            border: "2px solid #2a2418",
            margin: "0 auto 12px",
            display: "grid", placeItems: "center",
            fontWeight: 800, color: "#2a2418",
          }}>L</div>
          <h2 style={{ margin: 0, color: "#2a2418", fontWeight: 800 }}>
            {mode === "login" ? "Chào mừng trở lại" : "Tham gia Bộ Lạc"}
          </h2>
          <p style={{ margin: "6px 0 0", color: "#8a7d65", fontSize: 13 }}>
            {mode === "login" ? "Đăng nhập để lưu điểm cao của bạn" : "Tạo tài khoản để chơi và lưu thành tích"}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background: "rgba(186,26,26,0.08)",
            border: "1px solid rgba(186,26,26,0.25)",
            borderRadius: 12,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#ba1a1a",
            fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        {/* Google sign-in button */}
        <button
          type="button"
          onClick={googleLogin}
          disabled={btnDisabled}
          className="game-btn"
          style={{
            width: "100%",
            padding: "14px",
            background: "#fff",
            color: "#2a2418",
            border: "1.5px solid rgba(138,125,101,0.4)",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 14,
            cursor: btnDisabled ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            opacity: btnDisabled ? 0.6 : 1,
            marginBottom: 16,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Đăng nhập bằng Google
        </button>

        <div style={{ display: "flex", alignItems: "center", marginBottom: 16, color: "#8a7d65", fontSize: 12, fontWeight: 700 }}>
          <span style={{ flex: 1, height: 1, background: "rgba(138,125,101,0.25)" }} />
          <span style={{ padding: "0 12px" }}>HOẶC</span>
          <span style={{ flex: 1, height: 1, background: "rgba(138,125,101,0.25)" }} />
        </div>

        <form onSubmit={submit}>
          {mode === "signup" && (
            <Field icon={<User size={16} />} placeholder="Tên hiển thị" value={name} onChange={setName} />
          )}
          <Field icon={<Mail size={16} />} type="email" placeholder="Email" value={email} onChange={setEmail} required />
          <Field icon={<Lock size={16} />} type="password" placeholder="Mật khẩu" value={pwd} onChange={setPwd} required />

          <button type="submit" disabled={btnDisabled} className="game-btn game-btn-primary" style={{
            width: "100%", marginTop: 8, padding: "14px",
            opacity: btnDisabled ? 0.6 : 1,
            cursor: btnDisabled ? "wait" : "pointer",
          }}>
            {submitting ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#6b6149" }}>
          {mode === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
          <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); clearError(); }} className="game-btn-link">
            {mode === "login" ? "Đăng ký" : "Đăng nhập"}
          </button>
        </div>

        <p style={{ fontSize: 11, color: "#a89c80", textAlign: "center", marginTop: 14, marginBottom: 0 }}>
          🔐 Dữ liệu được lưu trên Firebase
        </p>
      </div>
    </div>
  );
}

function Field({ icon, type = "text", placeholder, value, onChange, required }: {
  icon: React.ReactNode; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 14px", marginBottom: 12,
      background: "#fff", border: "1.5px solid rgba(138,125,101,0.4)",
      borderRadius: 14,
    }}>
      <span style={{ color: "#8a7d65" }}>{icon}</span>
      <input
        type={type} placeholder={placeholder} value={value} required={required}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: "none", outline: "none", width: "100%",
          background: "transparent", fontSize: 14,
          fontFamily: "Be Vietnam Pro, sans-serif", color: "#2a2418",
        }}
      />
    </label>
  );
}
