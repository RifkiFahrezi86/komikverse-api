import { useAdmin, formatRupiah, statusConfig, priorityConfig } from "./AdminContext";
import { FolderOpen, Clock, CheckCircle2, Zap, Users, MessageSquare, DollarSign, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const { projects, customers, comments } = useAdmin();

  const totalRevenue = projects.filter(p => p.status === "selesai").reduce((a, p) => a + p.price, 0);
  const pendingRevenue = projects.filter(p => p.status !== "selesai" && p.status !== "dibatalkan").reduce((a, p) => a + p.price, 0);

  const stats = [
    { icon: FolderOpen, label: "Total Proyek", value: projects.length, color: "#06b6d4" },
    { icon: Clock, label: "Dalam Pengerjaan", value: projects.filter(p => p.status === "dalam_pengerjaan").length, color: "#f59e0b" },
    { icon: CheckCircle2, label: "Selesai", value: projects.filter(p => p.status === "selesai").length, color: "#22c55e" },
    { icon: Zap, label: "Express", value: projects.filter(p => p.priority === "express").length, color: "#ef4444" },
    { icon: Users, label: "Total Pelanggan", value: customers.length, color: "#8b5cf6" },
    { icon: MessageSquare, label: "Komentar", value: comments.length, color: "#ec4899" },
    { icon: DollarSign, label: "Pendapatan", value: formatRupiah(totalRevenue), color: "#22c55e", isText: true },
    { icon: TrendingUp, label: "Pending Revenue", value: formatRupiah(pendingRevenue), color: "#f59e0b", isText: true },
  ];

  const recentProjects = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const recentComments = [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);

  // Service distribution
  const serviceCount: Record<string, number> = {};
  projects.forEach(p => { serviceCount[p.service] = (serviceCount[p.service] || 0) + 1; });
  const topServices = Object.entries(serviceCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "24px", color: "#f1f5f9" }}>
          Dashboard
        </h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
          Ringkasan aktivitas dan statistik layanan joki tugas
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-5 border transition-all hover:-translate-y-0.5"
            style={{ background: "#1e293b", borderColor: `${stat.color}30` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${stat.color}15` }}>
                  <stat.icon size={20} style={{ color: stat.color }} />
                </div>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b", marginBottom: "2px" }}>
                  {stat.label}
                </p>
              </div>
              <span
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 700,
                  fontSize: (stat as { isText?: boolean }).isText ? "16px" : "28px",
                  color: "#f1f5f9",
                }}
              >
                {stat.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-2 rounded-xl border p-6" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
          <h2 className="mb-4" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "16px", color: "#f1f5f9" }}>
            Proyek Terbaru
          </h2>
          <div className="space-y-3">
            {recentProjects.map(project => {
              const sConf = statusConfig[project.status];
              const pConf = priorityConfig[project.priority];
              return (
                <div key={project.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/[0.02] transition-colors" style={{ borderBottom: "1px solid rgba(148,163,184,0.05)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "14px", color: "#f1f5f9" }}>
                        {project.projectName}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{ background: pConf.bgColor, border: `1px solid ${pConf.borderColor}`, fontSize: "10px", fontWeight: 600, color: pConf.color }}>
                        {pConf.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#475569" }}>{project.clientName}</span>
                      <span style={{ fontSize: "12px", color: "#06b6d4" }}>{project.service}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full" style={{ background: sConf.bgColor, border: `1px solid ${sConf.borderColor}`, fontFamily: "Inter, sans-serif", fontSize: "11px", fontWeight: 600, color: sConf.color }}>
                      {sConf.label}
                    </span>
                    <div className="mt-1 flex items-center gap-2 justify-end">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(148,163,184,0.1)" }}>
                        <div className="h-full rounded-full" style={{ width: `${project.progress}%`, background: project.progress === 100 ? "#22c55e" : pConf.color }} />
                      </div>
                      <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "11px", fontWeight: 600, color: "#94a3b8" }}>{project.progress}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Top Services */}
          <div className="rounded-xl border p-6" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
            <h2 className="mb-4" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "16px", color: "#f1f5f9" }}>
              Layanan Populer
            </h2>
            <div className="space-y-3">
              {topServices.map(([service, count], i) => (
                <div key={service} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#cbd5e1" }}>{service}</span>
                  <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "13px", fontWeight: 600, color: "#06b6d4" }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Comments */}
          <div className="rounded-xl border p-6" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
            <h2 className="mb-4" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "16px", color: "#f1f5f9" }}>
              Komentar Terbaru
            </h2>
            <div className="space-y-3">
              {recentComments.map(c => (
                <div key={c.id} className="p-3 rounded-lg" style={{ background: "rgba(15,23,42,0.5)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", fontWeight: 600, color: "#f1f5f9" }}>{c.customerName}</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < c.rating ? "#f59e0b" : "#334155"} xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b", lineHeight: 1.5 }} className="line-clamp-2">
                    {c.comment}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
