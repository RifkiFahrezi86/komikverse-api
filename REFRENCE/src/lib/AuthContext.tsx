import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "customer";
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, phone: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  resetPassword: (email: string, token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restore user from localStorage immediately (no loading flash)
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem("ch_auth_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Sync user state to localStorage
  const updateUser = (u: AuthUser | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem("ch_auth_user", JSON.stringify(u));
    } else {
      localStorage.removeItem("ch_auth_user");
    }
  };

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();
      if (data.user) {
        updateUser(data.user);
      } else {
        // Cookie expired or invalid, but keep localStorage user for now
        // Only clear if server explicitly says unauthorized
        if (res.status === 401) {
          updateUser(null);
        }
      }
    } catch {
      // Network error — keep existing localStorage user (offline support)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        updateUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Login gagal" };
    } catch {
      return { success: false, error: "Gagal terhubung ke server" };
    }
  };

  const register = async (name: string, email: string, password: string, phone: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password, phone }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        updateUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Registrasi gagal" };
    } catch {
      return { success: false, error: "Gagal terhubung ke server" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    updateUser(null);
  };

  const forgotPassword = async (email: string) => {
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || "Gagal mengirim kode reset" };
    } catch {
      return { success: false, error: "Gagal terhubung ke server" };
    }
  };

  const resetPassword = async (email: string, token: string, newPassword: string) => {
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true };
      }
      return { success: false, error: data.error || "Gagal reset password" };
    } catch {
      return { success: false, error: "Gagal terhubung ke server" };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, forgotPassword, resetPassword, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
