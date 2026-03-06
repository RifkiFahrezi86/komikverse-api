import { useProjects, statusConfig, priorityConfig, type ProjectPriority, type ProjectStatus } from "./ProjectContext";
import { Zap, Clock, Calendar, ArrowRight } from "lucide-react";

const priorityIcons = { express: Zap, standard: Clock, reguler: Calendar };

export default function ProjectsSection() {
  const { projects } = useProjects();
  const activeProjects = projects.filter((p) => p.status !== "kosong");

  return (
    <section id="proyek" className="py-20 md:py-28" style={{ background: "#1e293b" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span
            className="inline-block px-4 py-1.5 rounded-full mb-4"
            style={{
              background: "rgba(139,92,246,0.1)",
              border: "1px solid rgba(139,92,246,0.2)",
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "12px",
              letterSpacing: "2px",
              color: "#8b5cf6",
            }}
          >
            PROYEK AKTIF
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
            Proyek yang Sedang <span style={{ color: "#8b5cf6" }}>Dikerjakan</span>
          </h2>
          <p
            className="max-w-2xl mx-auto"
            style={{ fontFamily: "Inter, sans-serif", fontSize: "15px", lineHeight: 1.7, color: "#64748b" }}
          >
            Transparansi penuh - lihat progres proyek yang sedang kami kerjakan
          </p>
        </div>

        {activeProjects.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl border"
            style={{ background: "#0f172a", borderColor: "rgba(148,163,184,0.08)" }}
          >
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: "rgba(148,163,184,0.1)" }}
            >
              <Calendar size={28} style={{ color: "#64748b" }} />
            </div>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "16px", color: "#64748b" }}>
              Belum ada proyek aktif saat ini
            </p>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#475569", marginTop: "8px" }}>
              Hubungi kami untuk memulai proyek baru!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeProjects.map((project) => {
              const sConf = statusConfig[project.status as ProjectStatus];
              const pConf = priorityConfig[project.priority as ProjectPriority];
              const PIcon = priorityIcons[project.priority as ProjectPriority];

              return (
                <div
                  key={project.id}
                  className="rounded-xl border overflow-hidden transition-all hover:-translate-y-1"
                  style={{ background: "#0f172a", borderColor: "rgba(148,163,184,0.08)" }}
                >
                  <div className="h-1" style={{ background: `linear-gradient(90deg, ${pConf.color}, ${sConf.color})` }} />

                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
                        style={{
                          background: pConf.bgColor,
                          border: `1px solid ${pConf.borderColor}`,
                          fontFamily: "Inter, sans-serif",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: pConf.color,
                        }}
                      >
                        <PIcon size={12} />
                        {pConf.label}
                      </span>
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full"
                        style={{
                          background: sConf.bgColor,
                          border: `1px solid ${sConf.borderColor}`,
                          fontFamily: "Inter, sans-serif",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: sConf.color,
                        }}
                      >
                        {sConf.label}
                      </span>
                    </div>

                    <h3
                      className="mb-1"
                      style={{
                        fontFamily: "Space Grotesk, sans-serif",
                        fontWeight: 600,
                        fontSize: "16px",
                        color: "#f1f5f9",
                      }}
                    >
                      {project.projectName}
                    </h3>
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b" }} className="mb-3">
                      Klien: {project.clientName}
                    </p>
                    <p
                      className="mb-4"
                      style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", lineHeight: 1.5, color: "#94a3b8" }}
                    >
                      {project.description.length > 80
                        ? project.description.slice(0, 80) + "..."
                        : project.description}
                    </p>

                    <div className="mb-4">
                      <span
                        className="px-2.5 py-1 rounded-md"
                        style={{
                          background: "rgba(6,182,212,0.1)",
                          fontFamily: "Inter, sans-serif",
                          fontSize: "11px",
                          fontWeight: 500,
                          color: "#06b6d4",
                        }}
                      >
                        {project.service}
                      </span>
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between mb-1.5">
                        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b" }}>
                          Progress
                        </span>
                        <span
                          style={{
                            fontFamily: "Space Grotesk, sans-serif",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#f1f5f9",
                          }}
                        >
                          {project.progress}%
                        </span>
                      </div>
                      <div
                        className="w-full h-2 rounded-full overflow-hidden"
                        style={{ background: "rgba(148,163,184,0.1)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${project.progress}%`,
                            background:
                              project.progress === 100
                                ? "linear-gradient(90deg, #22c55e, #16a34a)"
                                : `linear-gradient(90deg, ${pConf.color}, ${pConf.color}cc)`,
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className="flex items-center justify-between pt-3"
                      style={{ borderTop: "1px solid rgba(148,163,184,0.06)" }}
                    >
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#475569" }}>
                        Deadline: {project.deadline}
                      </span>
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#475569" }}>
                        Update: {project.updatedAt}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
          {(Object.entries(priorityConfig) as [ProjectPriority, typeof priorityConfig.express][]).map(
            ([key, conf]) => {
              const PIcon = priorityIcons[key];
              return (
                <div key={key} className="flex items-center gap-2">
                  <PIcon size={14} style={{ color: conf.color }} />
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#94a3b8" }}>
                    <strong style={{ color: conf.color }}>{conf.label}</strong> - {conf.desc}
                  </span>
                </div>
              );
            }
          )}
        </div>
      </div>
    </section>
  );
}
