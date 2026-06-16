import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getRedirectResult } from "firebase/auth";
import {
  type User,
  auth,
  onAuthChange,
  loginWithGoogle,
  signUpWithEmail,
  signInWithEmail,
  logout as fbLogout,
} from "../../lib/firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  error: null,
  loginWithGoogle: async () => {},
  signUp: async () => {},
  signIn: async () => {},
  logout: async () => {},
  clearError: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handle redirect result (Google OAuth fallback for popup-blockers / in-app browsers)
    getRedirectResult(auth).catch((err) => {
      console.error("Redirect auth error:", err);
      if (err.code === "auth/web-storage-unsupported") {
        setError("Trình duyệt Ẩn danh (Incognito) đang chặn lưu trữ. Vui lòng tắt chế độ Ẩn danh!");
      }
    });

    const unsub = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const wrap = async (fn: () => Promise<User | undefined | void>) => {
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      const msg: string = e?.message ?? String(e);
      if (msg.includes("email-already-in-use")) setError("Email này đã được đăng ký.");
      else if (msg.includes("invalid-email")) setError("Email không hợp lệ.");
      else if (msg.includes("weak-password") || msg.includes("at least 6 characters"))
        setError("Mật khẩu quá yếu (tối thiểu 6 ký tự).");
      else if (msg.includes("invalid-credential") || msg.includes("wrong-password"))
        setError("Email hoặc mật khẩu không đúng.");
      else if (msg.includes("popup-closed-by-user"))
        setError("Bạn đã đóng cửa sổ đăng nhập.");
      else if (msg.includes("POPUP_TIMEOUT"))
        setError("Đăng nhập popup bị chặn. Đang thử redirect…");
      else setError("Có lỗi xảy ra. Vui lòng thử lại.");
      throw e;
    }
  };

  const googleLogin = () => wrap(async () => { await loginWithGoogle(); });
  const emailSignUp = (email: string, password: string, displayName: string) =>
    wrap(async () => { await signUpWithEmail(email, password, displayName); });
  const emailSignIn = (email: string, password: string) =>
    wrap(async () => { await signInWithEmail(email, password); });
  const doLogout = () => wrap(async () => { await fbLogout(); });
  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        loginWithGoogle: googleLogin,
        signUp: emailSignUp,
        signIn: emailSignIn,
        logout: doLogout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
