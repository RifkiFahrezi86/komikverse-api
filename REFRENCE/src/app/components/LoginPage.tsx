import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Code2, Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      // Check user role from localStorage (just set by login)
      try {
        const savedUser = localStorage.getItem("ch_auth_user");
        const parsed = savedUser ? JSON.parse(savedUser) : null;
        if (parsed?.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/dashboard");
        }
      } catch {
        navigate("/dashboard");
      }
    } else {
      setError(result.error || "Login gagal");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)" }}
    >
      {/* Background dots */}
      <div className="fixed inset-0 pointer-events-none" style={{ opacity: 0.03 }}>
        <div
          className="w-full h-full"
          style={{
            backgroundImage: "radial-gradient(circle, #06b6d4 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}
            >
              <Code2 size={20} color="white" />
            </div>
            <span
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 700,
                fontSize: "22px",
                color: "#f1f5f9",
              }}
            >
              Code<span style={{ color: "#06b6d4" }}>Help</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-8"
          style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}
        >
          <h1
            className="text-center mb-2"
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              fontSize: "24px",
              color: "#f1f5f9",
            }}
          >
            Selamat Datang
          </h1>
          <p
            className="text-center mb-8"
            style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b" }}
          >
            Masuk ke akun Anda
          </p>

          {error && (
            <div
              className="flex items-center gap-2 p-3 rounded-lg mb-6"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <AlertCircle size={16} style={{ color: "#ef4444" }} />
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#ef4444" }}>
                {error}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                className="block mb-1.5"
                style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2 focus:ring-cyan-500/30"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "14px",
                  color: "#f1f5f9",
                  background: "rgba(15,23,42,0.5)",
                  border: "1px solid rgba(148,163,184,0.12)",
                }}
                placeholder="email@contoh.com"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#06b6d4" }}
                  className="hover:underline"
                >
                  Lupa password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-xl outline-none transition-all focus:ring-2 focus:ring-cyan-500/30"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "14px",
                    color: "#f1f5f9",
                    background: "rgba(15,23,42,0.5)",
                    border: "1px solid rgba(148,163,184,0.12)",
                  }}
                  placeholder="Masukkan password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: "#64748b" }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all disabled:opacity-50"
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: "14px",
                background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                color: "white",
                boxShadow: "0 4px 16px rgba(6,182,212,0.3)",
              }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={16} />
                  Masuk
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#64748b" }}>
              Belum punya akun?{" "}
            </span>
            <Link
              to="/register"
              className="hover:underline"
              style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 600, color: "#06b6d4" }}
            >
              Daftar sekarang
            </Link>
          </div>
        </div>

        {/* Back to home */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="hover:underline"
            style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#64748b" }}
          >
            ← Kembali ke beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
