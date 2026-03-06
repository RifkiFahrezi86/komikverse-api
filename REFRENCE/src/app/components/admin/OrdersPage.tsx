import { useState } from "react";
import { Plus, Search, Pencil, Trash2, X, Eye, MessageCircle, CheckCircle2 } from "lucide-react";
import {
  useAdmin,
  formatRupiah,
  statusConfig,
  priorityConfig,
  type Project,
  type ProjectStatus,
  type ProjectPriority,
} from "./AdminContext";

export default function OrdersPage() {
  const { projects, services, addProject, updateProject, deleteProject } = useAdmin();
  const [activeFilter, setActiveFilter] = useState<ProjectStatus | "semua">("semua");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    projectName: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    service: "Website Development",
    priority: "standard" as ProjectPriority,
    status: "kosong" as ProjectStatus,
    progress: 0,
    price: 0,
    description: "",
    deadline: "",
    isApproved: false,
  });

  const filterTabs: { label: string; value: ProjectStatus | "semua" }[] = [
    { label: "Semua", value: "semua" },
    { label: "Menunggu", value: "kosong" },
    { label: "Dalam Pengerjaan", value: "dalam_pengerjaan" },
    { label: "Selesai", value: "selesai" },
    { label: "Dibatalkan", value: "dibatalkan" },
  ];

  const filtered = projects
    .filter(p => activeFilter === "semua" || p.status === activeFilter)
    .filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return p.projectName.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q) || p.service.toLowerCase().includes(q);
    });

  const resetForm = () => {
    setFormData({ projectName: "", clientName: "", clientEmail: "", clientPhone: "", service: "Website Development", priority: "standard", status: "kosong", progress: 0, price: 0, description: "", deadline: "", isApproved: false });
    setEditingProject(null);
  };

  const openAdd = () => { resetForm(); setShowModal(true); };
  const openEdit = (p: Project) => {
    setEditingProject(p);
    setFormData({ projectName: p.projectName, clientName: p.clientName, clientEmail: p.clientEmail, clientPhone: p.clientPhone, service: p.service, priority: p.priority, status: p.status, progress: p.progress, price: p.price, description: p.description, deadline: p.deadline, isApproved: p.isApproved });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject) {
      updateProject(editingProject.id, formData);
    } else {
      addProject(formData);
    }
    setShowModal(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm("Yakin ingin menghapus pesanan ini?")) deleteProject(id);
  };

  const handleStatusChange = (id: string, status: ProjectStatus) => {
    updateProject(id, { status, progress: status === "selesai" ? 100 : undefined });
  };

  const handleApprove = (id: string) => {
    updateProject(id, { isApproved: true });
  };

  const inputStyle = {
    fontFamily: "Inter, sans-serif",
    fontSize: "14px",
    color: "#f1f5f9",
    background: "rgba(15,23,42,0.5)",
    border: "1px solid rgba(148,163,184,0.1)",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "24px", color: "#f1f5f9" }}>
            Pesanan
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
            Kelola semua pesanan joki tugas
          </p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 600, background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>
          <Plus size={18} /> Tambah Pesanan
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }} />
          <input
            type="text"
            placeholder="Cari pesanan, klien, layanan..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30"
            style={inputStyle}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {filterTabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className="px-3 py-1.5 rounded-lg transition-all text-sm"
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
                background: activeFilter === tab.value ? "linear-gradient(135deg, #06b6d4, #0891b2)" : "#1e293b",
                color: activeFilter === tab.value ? "white" : "#94a3b8",
                border: activeFilter === tab.value ? "none" : "1px solid rgba(148,163,184,0.08)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                {["Proyek", "Layanan", "Prioritas", "Status", "Progress", "Harga", "Aksi"].map(h => (
                  <th key={h} className="text-left px-5 py-4" style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", color: "#64748b", textTransform: "uppercase" as const }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(project => {
                const pConf = priorityConfig[project.priority];
                const sConf = statusConfig[project.status];
                const isExpanded = expandedId === project.id;
                return (
                  <>
                    <tr key={project.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.04)" }} className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : project.id)}>
                      <td className="px-5 py-4">
                        <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "14px", color: "#f1f5f9" }}>
                          {project.projectName}
                          {project.isApproved && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", letterSpacing: "0.5px" }}>APPROVED</span>
                          )}
                        </div>
                        <div style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#475569", marginTop: "2px" }}>{project.clientName}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", fontWeight: 500, color: "#06b6d4" }}>{project.service}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full" style={{ background: pConf.bgColor, border: `1px solid ${pConf.borderColor}`, fontFamily: "Inter, sans-serif", fontSize: "11px", fontWeight: 600, color: pConf.color }}>
                          {pConf.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <select value={project.status} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); handleStatusChange(project.id, e.target.value as ProjectStatus); }} className="px-2 py-1 rounded-lg text-xs font-semibold outline-none cursor-pointer" style={{ background: sConf.bgColor, border: `1px solid ${sConf.borderColor}`, color: sConf.color }}>
                          <option value="kosong" style={{ background: "#1e293b", color: "#94a3b8" }}>Menunggu</option>
                          <option value="dalam_pengerjaan" style={{ background: "#1e293b", color: "#f59e0b" }}>Dalam Pengerjaan</option>
                          <option value="selesai" style={{ background: "#1e293b", color: "#22c55e" }}>Selesai</option>
                          <option value="dibatalkan" style={{ background: "#1e293b", color: "#ef4444" }}>Dibatalkan</option>
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: "rgba(148,163,184,0.1)" }}>
                            <div className="h-full rounded-full" style={{ width: `${project.progress}%`, background: project.progress === 100 ? "linear-gradient(90deg, #22c55e, #16a34a)" : `linear-gradient(90deg, ${pConf.color}, ${pConf.color}cc)` }} />
                          </div>
                          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "12px", fontWeight: 600, color: "#f1f5f9" }}>{project.progress}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "13px", fontWeight: 600, color: "#22c55e" }}>{formatRupiah(project.price)}</span>
                      </td>
                      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {!project.isApproved && (
                            <button onClick={() => handleApprove(project.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }} title="Approve">
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          <button onClick={() => setExpandedId(isExpanded ? null : project.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(148,163,184,0.1)", color: "#94a3b8" }} title="Detail">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => openEdit(project)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4" }} title="Edit">
                            <Pencil size={14} />
                          </button>
                          <a href={`https://wa.me/${project.clientPhone}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(37,211,102,0.1)", color: "#25D366" }} title="WhatsApp">
                            <MessageCircle size={14} />
                          </a>
                          <button onClick={() => handleDelete(project.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }} title="Hapus">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={project.id + "-detail"}>
                        <td colSpan={7} className="px-5 py-4" style={{ background: "rgba(15,23,42,0.3)" }}>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "1px", marginBottom: "4px" }}>Info Klien</p>
                              <p style={{ fontSize: "13px", color: "#f1f5f9" }}>{project.clientName}</p>
                              <p style={{ fontSize: "12px", color: "#94a3b8" }}>{project.clientEmail}</p>
                              <p style={{ fontSize: "12px", color: "#94a3b8" }}>{project.clientPhone}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "1px", marginBottom: "4px" }}>Detail Proyek</p>
                              <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: 1.6 }}>{project.description}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "1px", marginBottom: "4px" }}>Timeline</p>
                              <p style={{ fontSize: "12px", color: "#94a3b8" }}>Deadline: <span style={{ color: "#f1f5f9" }}>{project.deadline}</span></p>
                              <p style={{ fontSize: "12px", color: "#94a3b8" }}>Dibuat: <span style={{ color: "#f1f5f9" }}>{project.createdAt}</span></p>
                              <p style={{ fontSize: "12px", color: "#94a3b8" }}>Update: <span style={{ color: "#f1f5f9" }}>{project.updatedAt}</span></p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center" style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b" }}>
                    Tidak ada pesanan ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => { setShowModal(false); resetForm(); }} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-8" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "20px", color: "#f1f5f9" }}>
                {editingProject ? "Edit Pesanan" : "Tambah Pesanan Baru"}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} style={{ color: "#94a3b8" }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { label: "Nama Proyek", key: "projectName", type: "text" },
                { label: "Nama Klien", key: "clientName", type: "text" },
                { label: "Email Klien", key: "clientEmail", type: "email" },
                { label: "No. WhatsApp Klien", key: "clientPhone", type: "tel" },
              ].map(field => (
                <div key={field.key}>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>{field.label}</label>
                  <input type={field.type} value={formData[field.key as keyof typeof formData] as string} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none transition-all focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} required />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Layanan</label>
                  <select value={formData.service} onChange={e => setFormData({ ...formData, service: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none" style={inputStyle}>
                    {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Prioritas</label>
                  <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as ProjectPriority })} className="w-full px-4 py-2.5 rounded-lg outline-none" style={inputStyle}>
                    <option value="reguler">Reguler</option>
                    <option value="standard">Standard</option>
                    <option value="express">Express</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as ProjectStatus })} className="w-full px-4 py-2.5 rounded-lg outline-none" style={inputStyle}>
                    <option value="kosong">Menunggu</option>
                    <option value="dalam_pengerjaan">Dalam Pengerjaan</option>
                    <option value="selesai">Selesai</option>
                    <option value="dibatalkan">Dibatalkan</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Harga (Rp)</label>
                  <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-lg outline-none" style={inputStyle} required />
                </div>
              </div>

              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Progress ({formData.progress}%)</label>
                <input type="range" min="0" max="100" value={formData.progress} onChange={e => setFormData({ ...formData, progress: parseInt(e.target.value) })} className="w-full mt-1" style={{ accentColor: "#06b6d4" }} />
              </div>

              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Deadline</label>
                <input type="date" value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none" style={inputStyle} required />
              </div>

              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Deskripsi</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-4 py-2.5 rounded-lg outline-none resize-none" style={inputStyle} required />
              </div>

              <button type="submit" className="w-full py-3 rounded-xl transition-all mt-2" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "14px", background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>
                {editingProject ? "Update Pesanan" : "Tambah Pesanan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
