import { ArrowRight } from "lucide-react";
import { useSiteSettings } from "./useSiteSettings";

export default function CTABanner() {
  const settings = useSiteSettings();
  return (
    <section
      className="py-16 md:py-20 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2, #8b5cf6)" }}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2
          className="mb-4"
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontWeight: 700,
            fontSize: "clamp(22px, 3vw, 34px)",
            color: "white",
          }}
        >
          Punya Tugas atau Proyek? Hubungi Kami Sekarang!
        </h2>
        <p
          className="mb-8 max-w-2xl mx-auto"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "15px",
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.8)",
          }}
        >
          Konsultasi gratis dan dapatkan penawaran terbaik untuk proyek Anda
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href={`https://wa.me/${settings.whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg transition-all shadow-lg"
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "15px",
              background: "white",
              color: "#0f172a",
            }}
          >
            WhatsApp <ArrowRight size={16} />
          </a>
          <a
            href="#kontak"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg transition-all border"
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "15px",
              color: "white",
              borderColor: "rgba(255,255,255,0.4)",
            }}
          >
            Order Form
          </a>
        </div>
      </div>
    </section>
  );
}
