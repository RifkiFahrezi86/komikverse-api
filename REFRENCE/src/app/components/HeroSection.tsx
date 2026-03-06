import { Zap, ArrowRight, CheckCircle } from "lucide-react";
import { useSiteSettings } from "./useSiteSettings";

export default function HeroSection() {
  const settings = useSiteSettings();
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{ background: "radial-gradient(ellipse at 20% 50%, rgba(6,182,212,0.08) 0%, transparent 60%)" }}
        />
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{ background: "radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06) 0%, transparent 50%)" }}
        />
        <div
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full"
          style={{ background: "rgba(6,182,212,0.03)", filter: "blur(80px)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 md:py-40 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
              style={{
                background: "rgba(6,182,212,0.1)",
                border: "1px solid rgba(6,182,212,0.2)",
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
                fontWeight: 500,
                color: "#06b6d4",
              }}
            >
              <Zap size={14} />
              Jasa IT #1 Terpercaya di Indonesia
            </div>

            <h1
              className="mb-6"
              style={{
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 800,
                fontSize: "clamp(32px, 5vw, 56px)",
                lineHeight: 1.1,
                color: "#f1f5f9",
              }}
            >
              {settings.heroTitle}
            </h1>

            <p
              className="mb-8 max-w-lg"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "16px",
                lineHeight: 1.8,
                color: "#94a3b8",
              }}
            >
              {settings.heroSubtitle} {settings.heroDescription}
            </p>

            <div className="flex flex-wrap gap-4 mb-10">
              <a
                href={`https://wa.me/${settings.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg transition-all shadow-lg"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: "15px",
                  background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                  color: "white",
                  boxShadow: "0 8px 32px rgba(6,182,212,0.3)",
                }}
              >
                Order via WhatsApp
                <ArrowRight size={16} />
              </a>
              <a
                href="#layanan"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg transition-all border"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: "15px",
                  color: "#cbd5e1",
                  borderColor: "rgba(203,213,225,0.2)",
                }}
              >
                Lihat Layanan
              </a>
              <a
                href="#cara-order"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg transition-all border"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: "15px",
                  color: "#cbd5e1",
                  borderColor: "rgba(203,213,225,0.2)",
                }}
              >
                Cara Order
              </a>
            </div>

            <div className="flex flex-wrap gap-6">
              {["Fast Response 24/7", "Garansi Revisi", "Source Code"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle size={16} style={{ color: "#22c55e" }} />
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#94a3b8" }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Code Preview Card */}
          <div className="hidden lg:block">
            <div className="relative">
              <div
                className="rounded-2xl overflow-hidden border"
                style={{
                  background: "#0c1222",
                  borderColor: "rgba(6,182,212,0.15)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                }}
              >
                <div
                  className="flex items-center gap-2 px-5 py-3"
                  style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}
                >
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span
                    className="ml-3"
                    style={{ fontFamily: "monospace", fontSize: "12px", color: "#475569" }}
                  >
                    App.tsx
                  </span>
                </div>
                <div className="p-6" style={{ fontFamily: "monospace", fontSize: "13px", lineHeight: 2 }}>
                  <div>
                    <span style={{ color: "#c084fc" }}>import</span>{" "}
                    <span style={{ color: "#67e8f9" }}>React</span>{" "}
                    <span style={{ color: "#c084fc" }}>from</span>{" "}
                    <span style={{ color: "#86efac" }}>{`'react'`}</span>;
                  </div>
                  <div>
                    <span style={{ color: "#c084fc" }}>import</span>{" "}
                    {"{ "}
                    <span style={{ color: "#67e8f9" }}>CodeHelp</span>
                    {" } "}
                    <span style={{ color: "#c084fc" }}>from</span>{" "}
                    <span style={{ color: "#86efac" }}>{`'@codehelp/sdk'`}</span>;
                  </div>
                  <div className="mt-2">
                    <span style={{ color: "#c084fc" }}>const</span>{" "}
                    <span style={{ color: "#fbbf24" }}>App</span>
                    {" = () => {"}
                  </div>
                  <div className="pl-6">
                    <span style={{ color: "#c084fc" }}>const</span>
                    {" ["}
                    <span style={{ color: "#67e8f9" }}>site</span>
                    {", "}
                    <span style={{ color: "#67e8f9" }}>setSite</span>
                    {"] = "}
                    <span style={{ color: "#fbbf24" }}>useState</span>
                    {"("}
                    <span style={{ color: "#c084fc" }}>null</span>
                    {");"}
                  </div>
                  <div className="pl-6 mt-1">
                    <span style={{ color: "#c084fc" }}>return</span>{" ("}
                  </div>
                  <div className="pl-10">
                    {"<"}
                    <span style={{ color: "#67e8f9" }}>CodeHelp</span>
                  </div>
                  <div className="pl-14">
                    <span style={{ color: "#94a3b8" }}>framework</span>
                    {"="}
                    <span style={{ color: "#86efac" }}>{`"react"`}</span>
                  </div>
                  <div className="pl-14">
                    <span style={{ color: "#94a3b8" }}>responsive</span>
                    {"="}
                    <span style={{ color: "#67e8f9" }}>{`{true}`}</span>
                  </div>
                  <div className="pl-14">
                    <span style={{ color: "#94a3b8" }}>deploy</span>
                    {"="}
                    <span style={{ color: "#86efac" }}>{`"production"`}</span>
                  </div>
                  <div className="pl-10">{"/>"}</div>
                  <div className="pl-6">{");"}</div>
                  <div>{"}"}</div>
                </div>
              </div>

              {/* Floating badges */}
              <div
                className="absolute -top-4 -right-4 px-4 py-2 rounded-xl flex items-center gap-2 animate-bounce"
                style={{
                  background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                  animationDuration: "3s",
                  boxShadow: "0 8px 24px rgba(6,182,212,0.3)",
                }}
              >
                <Zap size={14} className="text-white" />
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 700,
                    fontSize: "12px",
                    color: "white",
                  }}
                >
                  500+ Projects
                </span>
              </div>
              <div
                className="absolute -bottom-4 -left-4 px-4 py-2 rounded-xl flex items-center gap-2 animate-bounce"
                style={{
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  animationDuration: "4s",
                  boxShadow: "0 8px 24px rgba(34,197,94,0.3)",
                }}
              >
                <CheckCircle size={14} className="text-white" />
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 700,
                    fontSize: "12px",
                    color: "white",
                  }}
                >
                  24/7 Support
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
