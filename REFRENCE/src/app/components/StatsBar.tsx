import { CheckCircle, Users, Star, Clock } from "lucide-react";

const stats = [
  { icon: CheckCircle, number: "500+", label: "Proyek Selesai", color: "#22c55e" },
  { icon: Users, number: "100+", label: "Klien Puas", color: "#06b6d4" },
  { icon: Star, number: "4.9", label: "Rating", color: "#f59e0b" },
  { icon: Clock, number: "24/7", label: "Fast Response", color: "#8b5cf6" },
];

export default function StatsBar() {
  return (
    <section className="relative -mt-6 z-10 px-4 sm:px-6 lg:px-8">
      <div
        className="max-w-5xl mx-auto rounded-2xl py-8 px-6 border"
        style={{
          background: "rgba(30, 41, 59, 0.8)",
          backdropFilter: "blur(20px)",
          borderColor: "rgba(6,182,212,0.1)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-4 justify-center">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${stat.color}15` }}
              >
                <stat.icon size={22} style={{ color: stat.color }} />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: 700,
                    fontSize: "24px",
                    color: "#f1f5f9",
                  }}
                >
                  {stat.number}
                </div>
                <div
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
