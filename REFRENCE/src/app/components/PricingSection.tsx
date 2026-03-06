import { Check, X, Zap, Clock, Calendar, Star, Shield, Rocket, Crown, Diamond, type LucideIcon } from "lucide-react";
import { useSiteSettings } from "./useSiteSettings";
import type { PricingPlan } from "./admin/AdminContext";

const iconMap: Record<string, LucideIcon> = {
  Calendar, Clock, Zap, Star, Shield, Rocket, Crown, Diamond,
};

export default function PricingSection() {
  const settings = useSiteSettings();
  const plans = (settings.pricingPlans || []).sort((a: PricingPlan, b: PricingPlan) => a.order - b.order);

  if (plans.length === 0) return null;

  return (
    <section id="harga" className="py-20 md:py-28" style={{ background: "#0f172a" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span
            className="inline-block px-4 py-1.5 rounded-full mb-4"
            style={{
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.2)",
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "12px",
              letterSpacing: "2px",
              color: "#f59e0b",
            }}
          >
            HARGA
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
            Paket <span style={{ color: "#f59e0b" }}>Harga</span>
          </h2>
          <p
            className="max-w-2xl mx-auto"
            style={{ fontFamily: "Inter, sans-serif", fontSize: "15px", lineHeight: 1.7, color: "#64748b" }}
          >
            Pilih paket sesuai kebutuhan - setiap paket menentukan prioritas pengerjaan
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => {
            const IconComp = iconMap[plan.icon] || Calendar;
            return (
            <div
              key={plan.name}
              className="relative rounded-2xl border p-8 transition-all hover:-translate-y-1"
              style={{
                background: plan.popular ? "linear-gradient(160deg, #1e293b, #0f172a)" : "#1e293b",
                borderColor: plan.popular ? `${plan.color}40` : "rgba(148,163,184,0.08)",
                boxShadow: plan.popular ? `0 8px 40px ${plan.color}15` : "none",
              }}
            >
              {plan.popular && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full"
                  style={{
                    background: plan.color,
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 700,
                    fontSize: "11px",
                    letterSpacing: "1px",
                    color: "#000",
                  }}
                >
                  POPULER
                </div>
              )}

              <div className="text-center mb-8">
                <div
                  className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: `${plan.color}15` }}
                >
                  <IconComp size={24} style={{ color: plan.color }} />
                </div>
                <h3
                  className="mb-1"
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: 600,
                    fontSize: "20px",
                    color: "#f1f5f9",
                  }}
                >
                  {plan.name}
                </h3>
                <div
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: 700,
                    fontSize: "22px",
                    color: plan.color,
                  }}
                >
                  {plan.price}
                </div>
              </div>

              <div className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <div key={f.text} className="flex items-center gap-3">
                    {f.ok ? (
                      <Check size={16} style={{ color: "#22c55e" }} className="shrink-0" />
                    ) : (
                      <X size={16} style={{ color: "#334155" }} className="shrink-0" />
                    )}
                    <span
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: "13px",
                        color: f.ok ? "#cbd5e1" : "#475569",
                      }}
                    >
                      {f.text}
                    </span>
                  </div>
                ))}
              </div>

              <a
                href="#kontak"
                className="block text-center py-3 rounded-lg transition-all"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                  background: plan.popular ? plan.color : "transparent",
                  color: plan.popular ? "#000" : plan.color,
                  border: plan.popular ? "none" : `1px solid ${plan.color}40`,
                }}
              >
                Pilih Paket {plan.name}
              </a>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
