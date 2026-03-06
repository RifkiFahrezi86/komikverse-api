import { Globe, Smartphone, Palette, Code, BookOpen, Server, Bug, Plug, ArrowRight, Database, type LucideIcon } from "lucide-react";
import { useServices } from "./useServices";

const iconMap: Record<string, LucideIcon> = {
  Globe, Smartphone, Palette, Code, BookOpen, Server, Bug, Plug, Database,
};

const colorPalette = ["#06b6d4", "#8b5cf6", "#f59e0b", "#22c55e", "#ef4444", "#ec4899", "#3b82f6", "#14b8a6"];

export default function ServicesSection() {
  const services = useServices();
  return (
    <section id="layanan" className="py-20 md:py-28" style={{ background: "#0f172a" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span
            className="inline-block px-4 py-1.5 rounded-full mb-4"
            style={{
              background: "rgba(6,182,212,0.1)",
              border: "1px solid rgba(6,182,212,0.2)",
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "12px",
              letterSpacing: "2px",
              color: "#06b6d4",
            }}
          >
            LAYANAN
          </span>
          <h2
            className="mb-4"
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(24px, 3vw, 36px)",
              color: "#f1f5f9",
            }}
          >
            Layanan <span style={{ color: "#06b6d4" }}>Kami</span>
          </h2>
          <p
            className="max-w-2xl mx-auto"
            style={{ fontFamily: "Inter, sans-serif", fontSize: "15px", lineHeight: 1.7, color: "#64748b" }}
          >
            Berbagai layanan IT profesional untuk kebutuhan akademik dan bisnis Anda
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {services.map((s, idx) => {
            const Icon = iconMap[s.icon] || Code;
            const color = colorPalette[idx % colorPalette.length];
            return (
              <div
                key={s.id}
                className="group rounded-xl p-6 border transition-all duration-300 hover:-translate-y-1"
                style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = `${color}40`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(148,163,184,0.08)";
                }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-5 transition-colors"
                  style={{ background: `${color}15` }}
                >
                  <Icon size={22} style={{ color }} />
                </div>
                <h3
                  className="mb-2"
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: 600,
                    fontSize: "15px",
                    color: "#f1f5f9",
                  }}
                >
                  {s.name}
                </h3>
                <p
                  className="mb-4"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "13px",
                    lineHeight: 1.6,
                    color: "#64748b",
                  }}
                >
                  {s.description}
                </p>
                <a
                  href="#kontak"
                  className="inline-flex items-center gap-1 transition-all group-hover:gap-2"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 500,
                    fontSize: "13px",
                    color,
                  }}
                >
                  Selengkapnya <ArrowRight size={14} />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
