import { Mail, Phone, MapPin, Code2 } from "lucide-react";
import { useSiteSettings } from "./useSiteSettings";
import { useServices } from "./useServices";

export default function Footer() {
  const settings = useSiteSettings();
  const services = useServices();
  return (
    <footer style={{ background: "#0c1222" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}
              >
                <Code2 size={16} className="text-white" />
              </div>
              <span
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 700,
                  fontSize: "18px",
                  color: "#f1f5f9",
                }}
              >
                Code<span style={{ color: "#06b6d4" }}>Help</span>
              </span>
            </div>
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
                lineHeight: 1.7,
                color: "#64748b",
              }}
            >
              Jasa pembuatan website dan pemrograman profesional untuk mahasiswa dan bisnis di
              Indonesia.
            </p>
          </div>
          <div>
            <h4
              className="mb-4"
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 600,
                fontSize: "14px",
                color: "#f1f5f9",
              }}
            >
              Quick Links
            </h4>
            <ul className="space-y-2">
              {["Home", "Layanan", "Proyek", "Harga", "Testimoni", "Kontak"].map((l) => (
                <li key={l}>
                  <a
                    href={`#${l.toLowerCase()}`}
                    className="transition-colors hover:text-cyan-400"
                    style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#64748b" }}
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4
              className="mb-4"
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 600,
                fontSize: "14px",
                color: "#f1f5f9",
              }}
            >
              Layanan
            </h4>
            <ul className="space-y-2">
              {services.slice(0, 6).map(
                (s) => (
                  <li key={s.id}>
                    <a
                      href="#layanan"
                      className="transition-colors hover:text-cyan-400"
                      style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#64748b" }}
                    >
                      {s.name}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>
          <div>
            <h4
              className="mb-4"
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 600,
                fontSize: "14px",
                color: "#f1f5f9",
              }}
            >
              Kontak
            </h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <Mail size={14} style={{ color: "#06b6d4" }} />
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#64748b" }}>
                  {settings.email}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={14} style={{ color: "#06b6d4" }} />
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#64748b" }}>
                  {settings.phone}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <MapPin size={14} style={{ color: "#06b6d4" }} />
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#64748b" }}>
                  {settings.address}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(148,163,184,0.06)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#475569" }}>
            &copy; 2026 CodeHelp Indonesia. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
