import { useState, useEffect } from "react";
import { Menu, X, Code2, LogIn, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Layanan", href: "#layanan" },
  { label: "Proyek", href: "#proyek" },
  { label: "Harga", href: "#harga" },
  { label: "Testimoni", href: "#testimoni" },
  { label: "Kontak", href: "#kontak" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "shadow-lg shadow-black/20" : ""
      }`}
      style={{
        background: scrolled ? "rgba(15, 23, 42, 0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(6,182,212,0.1)" : "none",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          <a href="#home" className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}
            >
              <Code2 size={18} className="text-white" />
            </div>
            <span
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 700,
                fontSize: "20px",
                color: "#f1f5f9",
              }}
            >
              Code<span style={{ color: "#06b6d4" }}>Help</span>
            </span>
          </a>

          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 rounded-lg transition-all hover:bg-white/5"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#94a3b8",
                }}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                <a
                  href={user.role === "admin" ? "/admin" : "/dashboard"}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all border"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#06b6d4",
                    borderColor: "rgba(6,182,212,0.3)",
                  }}
                >
                  <LayoutDashboard size={14} />
                  {user.name}
                </a>
                <button
                  onClick={() => logout()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all border hover:bg-red-500/10"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#ef4444",
                    borderColor: "rgba(239,68,68,0.2)",
                  }}
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </>
            ) : (
              <a
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-all border"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  borderColor: "rgba(148,163,184,0.2)",
                }}
              >
                <LogIn size={14} />
                Login
              </a>
            )}
            <a
              href="https://wa.me/6285954092060"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-5 py-2.5 rounded-lg transition-all"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                color: "white",
              }}
            >
              Order Sekarang
            </a>
          </div>

          <button
            className="lg:hidden"
            style={{ color: "#f1f5f9" }}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="lg:hidden"
          style={{
            background: "rgba(15, 23, 42, 0.98)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(6,182,212,0.1)",
          }}
        >
          <div className="px-4 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="py-3 px-4 rounded-lg transition-all"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "#cbd5e1",
                }}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div
              className="flex gap-3 mt-4 pt-4"
              style={{ borderTop: "1px solid rgba(148,163,184,0.1)" }}
            >
              {user ? (
                <>
                  <a
                    href={user.role === "admin" ? "/admin" : "/dashboard"}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#06b6d4",
                      borderColor: "rgba(6,182,212,0.3)",
                    }}
                    onClick={() => setMobileOpen(false)}
                  >
                    <LayoutDashboard size={14} /> {user.role === "admin" ? "Admin" : "Dashboard"}
                  </a>
                  <button
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border"
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#ef4444",
                      borderColor: "rgba(239,68,68,0.2)",
                    }}
                    onClick={() => { logout(); setMobileOpen(false); }}
                  >
                    <LogOut size={14} /> Logout
                  </button>
                </>
              ) : (
                <a
                  href="/login"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#94a3b8",
                    borderColor: "rgba(148,163,184,0.2)",
                  }}
                  onClick={() => setMobileOpen(false)}
                >
                  <LogIn size={14} /> Login
                </a>
              )}
              <a
                href="https://wa.me/6285954092060"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center py-2.5 rounded-lg"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                  color: "white",
                }}
                onClick={() => setMobileOpen(false)}
              >
                Order
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
