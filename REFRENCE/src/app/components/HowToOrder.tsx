import { MessageCircle, Users, Code, CheckCircle } from "lucide-react";

const steps = [
  { icon: MessageCircle, step: "01", title: "Hubungi Kami", desc: "Kirim pesan via WhatsApp atau form order", color: "#06b6d4" },
  { icon: Users, step: "02", title: "Konsultasi Gratis", desc: "Diskusikan kebutuhan dan detail proyek", color: "#8b5cf6" },
  { icon: Code, step: "03", title: "Proses Pengerjaan", desc: "Tim kami mengerjakan dengan standar tinggi", color: "#f59e0b" },
  { icon: CheckCircle, step: "04", title: "Selesai & Revisi", desc: "Proyek selesai dengan garansi revisi", color: "#22c55e" },
];

export default function HowToOrder() {
  return (
    <section id="cara-order" className="py-20 md:py-28" style={{ background: "#0f172a" }}>
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
            CARA ORDER
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
            Cara <span style={{ color: "#06b6d4" }}>Order</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          <div
            className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-[2px] border-t-2 border-dashed"
            style={{ borderColor: "rgba(6,182,212,0.15)" }}
          />
          {steps.map((s) => (
            <div key={s.step} className="relative flex flex-col items-center text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-5 relative z-10"
                style={{ background: `${s.color}20`, boxShadow: `0 0 30px ${s.color}15` }}
              >
                <s.icon size={24} style={{ color: s.color }} />
              </div>
              <span
                className="mb-2"
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: s.color,
                  letterSpacing: "1px",
                }}
              >
                STEP {s.step}
              </span>
              <h3
                className="mb-2"
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "#f1f5f9",
                }}
              >
                {s.title}
              </h3>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", lineHeight: 1.6, color: "#64748b" }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
