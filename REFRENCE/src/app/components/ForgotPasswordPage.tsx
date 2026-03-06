import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Code2, Mail, KeyRound, AlertCircle, CheckCircle, ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";

type Step = "email" | "verify" | "done";

export default function ForgotPasswordPage() {
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await forgotPassword(email);
    setLoading(false);

    if (result.success) {
      setStep("verify");
    } else {
      setError(result.error || "Gagal mengirim kode reset");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Password dan konfirmasi tidak cocok");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }

    setLoading(true);
    const result = await resetPassword(email, token, newPassword);
    setLoading(false);

    if (result.success) {
      setStep("done");
    } else {
      setError(result.error || "Gagal reset password");
    }
  };

  const inputStyle = {
    fontFamily: "Inter, sans-serif",
    fontSize: "14px",
    color: "#f1f5f9",
    background: "rgba(15,23,42,0.5)",
    border: "1px solid rgba(148,163,184,0.12)",
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)" }}
    >
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
          {/* Step: Email */}
          {step === "email" && (
            <>
              <div className="text-center mb-8">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(6,182,212,0.1)" }}
                >
                  <Mail size={24} style={{ color: "#06b6d4" }} />
                </div>
                <h1
                  className="mb-2"
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: 700,
                    fontSize: "24px",
                    color: "#f1f5f9",
                  }}
                >
                  Lupa Password
                </h1>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b" }}>
                  Masukkan email yang terdaftar. Kode reset akan dikirim via WhatsApp.
                </p>
              </div>

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

              <form onSubmit={handleSendCode} className="space-y-5">
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
                    style={inputStyle}
                    placeholder="email@contoh.com"
                    required
                  />
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
                      <Mail size={16} />
                      Kirim Kode Reset
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* Step: Verify */}
          {step === "verify" && (
            <>
              <div className="text-center mb-8">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(6,182,212,0.1)" }}
                >
                  <KeyRound size={24} style={{ color: "#06b6d4" }} />
                </div>
                <h1
                  className="mb-2"
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: 700,
                    fontSize: "24px",
                    color: "#f1f5f9",
                  }}
                >
                  Reset Password
                </h1>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b" }}>
                  Masukkan kode 6 digit yang dikirim ke WhatsApp Anda beserta password baru.
                </p>
              </div>

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

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label
                    className="block mb-1.5"
                    style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}
                  >
                    Kode Reset (6 digit)
                  </label>
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2 focus:ring-cyan-500/30 text-center tracking-[0.5em]"
                    style={{ ...inputStyle, fontSize: "20px", fontWeight: 700, letterSpacing: "0.3em" }}
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                </div>

                <div>
                  <label
                    className="block mb-1.5"
                    style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}
                  >
                    Password Baru
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2 focus:ring-cyan-500/30"
                    style={inputStyle}
                    placeholder="Minimal 8 karakter"
                    required
                  />
                </div>

                <div>
                  <label
                    className="block mb-1.5"
                    style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}
                  >
                    Konfirmasi Password Baru
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2 focus:ring-cyan-500/30"
                    style={inputStyle}
                    placeholder="Ulangi password baru"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || token.length !== 6}
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
                      <KeyRound size={16} />
                      Reset Password
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setError("");
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2"
                  style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#64748b" }}
                >
                  <ArrowLeft size={14} />
                  Kembali
                </button>
              </form>
            </>
          )}

          {/* Step: Done */}
          {step === "done" && (
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(34,197,94,0.1)" }}
              >
                <ShieldCheck size={28} style={{ color: "#22c55e" }} />
              </div>
              <h2
                className="mb-2"
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 700,
                  fontSize: "22px",
                  color: "#f1f5f9",
                }}
              >
                Password Berhasil Direset!
              </h2>
              <p
                className="mb-6"
                style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b" }}
              >
                Silakan login dengan password baru Anda.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl transition-all"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                  background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                  color: "white",
                  boxShadow: "0 4px 16px rgba(6,182,212,0.3)",
                }}
              >
                <CheckCircle size={16} />
                Login Sekarang
              </button>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <Link
            to="/login"
            className="hover:underline"
            style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#64748b" }}
          >
            ← Kembali ke halaman login
          </Link>
        </div>
      </div>
    </div>
  );
}
