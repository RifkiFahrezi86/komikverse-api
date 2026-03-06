import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    q: "Metode pembayaran apa saja yang tersedia?",
    a: "Kami menerima transfer bank (BCA, BNI, BRI, Mandiri), e-wallet (GoPay, OVO, Dana, ShopeePay), dan QRIS. Pembayaran DP 50% di awal dan 50% setelah selesai.",
  },
  {
    q: "Bagaimana kebijakan revisi?",
    a: "Setiap paket memiliki jumlah revisi gratis berbeda. Reguler: 1x, Standard: 3x, Express: unlimited. Revisi di luar kuota dikenakan biaya tambahan.",
  },
  {
    q: "Apakah ada garansi?",
    a: "Ya, garansi 7-30 hari setelah proyek diserahkan. Selama masa garansi, kami perbaiki bug tanpa biaya tambahan.",
  },
  {
    q: "Berapa lama waktu pengerjaan?",
    a: "Tergantung paket dan kompleksitas. Express: 1-3 hari, Standard: 3-7 hari, Reguler: 7-14 hari. Tersedia layanan urgent.",
  },
  {
    q: "Apakah kerahasiaan data dijamin?",
    a: "Tentu! Kami menjaga kerahasiaan semua data klien. Tidak membagikan informasi ke pihak ketiga. NDA tersedia jika diperlukan.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-20 md:py-28" style={{ background: "#0f172a" }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
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
            FAQ
          </span>
          <h2
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(24px, 3vw, 36px)",
              color: "#f1f5f9",
            }}
          >
            Pertanyaan <span style={{ color: "#06b6d4" }}>Umum</span>
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden border transition-all"
              style={{
                background: "#1e293b",
                borderColor: openIndex === i ? "rgba(6,182,212,0.3)" : "rgba(148,163,184,0.08)",
              }}
            >
              <button
                className="w-full flex items-center justify-between p-5 text-left"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 600,
                    fontSize: "14px",
                    color: "#f1f5f9",
                    paddingRight: "16px",
                  }}
                >
                  {faq.q}
                </span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 transition-transform ${openIndex === i ? "rotate-180" : ""}`}
                  style={{ color: "#06b6d4" }}
                />
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5">
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", lineHeight: 1.7, color: "#94a3b8" }}>
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
