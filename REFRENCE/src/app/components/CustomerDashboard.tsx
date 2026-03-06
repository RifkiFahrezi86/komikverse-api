import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Code2, LogOut, Package, Clock, CheckCircle2, XCircle,
  AlertCircle, Trash2, ChevronDown, ChevronUp, Eye,
  Home, Plus, MessageCircle
} from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { useServices } from "./useServices";

// Types matching AdminContext
type ProjectStatus = "dalam_pengerjaan" | "selesai" | "kosong" | "dibatalkan";
type ProjectPriority = "express" | "standard" | "reguler";

interface Project {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  projectName: string;
  description: string;
  service: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  deadline: string;
  progress: number;
  price: number;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<ProjectStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  kosong: { label: "Menunggu Konfirmasi", color: "#94a3b8", bgColor: "rgba(148,163,184,0.15)", icon: Clock },
  dalam_pengerjaan: { label: "Sedang Dikerjakan", color: "#f59e0b", bgColor: "rgba(245,158,11,0.15)", icon: Package },
  selesai: { label: "Selesai", color: "#22c55e", bgColor: "rgba(34,197,94,0.15)", icon: CheckCircle2 },
  dibatalkan: { label: "Dibatalkan", color: "#ef4444", bgColor: "rgba(239,68,68,0.15)", icon: XCircle },
};

const priorityConfig: Record<ProjectPriority, { label: string; color: string }> = {
  express: { label: "Express", color: "#ef4444" },
  standard: { label: "Standard", color: "#f59e0b" },
  reguler: { label: "Reguler", color: "#06b6d4" },
};

function formatRupiah(amount: number): string {
  return "Rp " + amount.toLocaleString("id-ID");
}

// serviceOptions is now loaded dynamically via useServices hook

export default function CustomerDashboard() {
  const dynamicServices = useServices();
  const serviceOptions = dynamicServices.map(s => s.name);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<ProjectStatus | "semua">("semua");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [formData, setFormData] = useState({
    projectName: "",
    service: "Website Development",
    priority: "standard" as ProjectPriority,
    description: "",
    deadline: "",
  });

  // Load projects for this customer from API
  const loadProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (res.ok && data.projects) {
        setProjects(data.projects);
      }
    } catch {
      setProjects([]);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    loadProjects();
  }, [user]);

  const filtered = projects.filter((p) =>
    filter === "semua" ? true : p.status === filter
  );

  // Cancel order — only if NOT approved by admin
  const handleCancel = async (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    if (project.isApproved) {
      alert("Pesanan ini sudah dikonfirmasi admin dan tidak dapat dibatalkan. Hubungi admin via WhatsApp untuk pembatalan.");
      return;
    }
    if (!confirm("Yakin ingin membatalkan pesanan ini?")) return;

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dibatalkan" }),
      });
      if (res.ok) loadProjects();
      else alert("Gagal membatalkan pesanan");
    } catch { alert("Gagal membatalkan pesanan"); }
  };

  // Delete completed/cancelled orders
  const handleDelete = async (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    if (project.status !== "selesai" && project.status !== "dibatalkan") {
      alert("Hanya pesanan yang sudah selesai atau dibatalkan yang bisa dihapus.");
      return;
    }
    if (!confirm("Hapus pesanan ini dari daftar?")) return;

    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) loadProjects();
      else alert("Gagal menghapus pesanan");
    } catch { alert("Gagal menghapus pesanan"); }
  };

  // Submit new order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: formData.projectName,
          description: formData.description,
          service: formData.service,
          priority: formData.priority,
          deadline: formData.deadline,
        }),
      });
      if (res.ok) {
        loadProjects();
        setFormData({ projectName: "", service: "Website Development", priority: "standard", description: "", deadline: "" });
        setShowOrderForm(false);
      } else {
        const data = await res.json();
        alert(data.error || "Gagal membuat pesanan");
      }
    } catch { alert("Gagal membuat pesanan"); }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const counts = {
    total: projects.length,
    menunggu: projects.filter((p) => p.status === "kosong").length,
    dikerjakan: projects.filter((p) => p.status === "dalam_pengerjaan").length,
    selesai: projects.filter((p) => p.status === "selesai").length,
  };

  const inputStyle = {
    fontFamily: "Inter, sans-serif",
    fontSize: "14px",
    color: "#f1f5f9",
    background: "rgba(15,23,42,0.5)",
    border: "1px solid rgba(148,163,184,0.12)",
  };

  return (
    <div className="min-h-screen" style={{ background: "#0f172a" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: "rgba(15,23,42,0.95)",
          backdropFilter: "blur(20px)",
          borderColor: "rgba(6,182,212,0.1)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}
            >
              <Code2 size={16} className="text-white" />
            </div>
            <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "18px", color: "#f1f5f9" }}>
              Code<span style={{ color: "#06b6d4" }}>Help</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:bg-white/5"
              style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#94a3b8" }}
            >
              <Home size={14} />
              Home
            </Link>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)" }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)" }}
              >
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 600, color: "#06b6d4" }}>
                {user?.name}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:bg-red-500/10"
              style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#ef4444" }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page Title */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "24px", color: "#f1f5f9" }}>
              Dashboard Saya
            </h1>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
              Pantau status pesanan dan proyek Anda
            </p>
          </div>
          <button
            onClick={() => setShowOrderForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              background: "linear-gradient(135deg, #06b6d4, #0891b2)",
              color: "white",
              boxShadow: "0 4px 16px rgba(6,182,212,0.25)",
            }}
          >
            <Plus size={16} />
            Pesanan Baru
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Pesanan", value: counts.total, color: "#06b6d4", icon: Package },
            { label: "Menunggu", value: counts.menunggu, color: "#94a3b8", icon: Clock },
            { label: "Dikerjakan", value: counts.dikerjakan, color: "#f59e0b", icon: AlertCircle },
            { label: "Selesai", value: counts.selesai, color: "#22c55e", icon: CheckCircle2 },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl p-4 border"
              style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <stat.icon size={18} style={{ color: stat.color }} />
                <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "24px", color: stat.color }}>
                  {stat.value}
                </span>
              </div>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b" }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* New Order Form Modal */}
        {showOrderForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
            <div
              className="w-full max-w-lg rounded-2xl border p-6"
              style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.1)" }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "20px", color: "#f1f5f9" }}>
                  Pesanan Baru
                </h2>
                <button onClick={() => setShowOrderForm(false)} className="text-slate-400 hover:text-white">
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmitOrder} className="space-y-4">
                <div>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>
                    Nama Proyek / Tugas *
                  </label>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30"
                    style={inputStyle}
                    placeholder="Contoh: Website Toko Online"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>
                      Layanan *
                    </label>
                    <select
                      value={formData.service}
                      onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30"
                      style={inputStyle}
                    >
                      {serviceOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>
                      Prioritas
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as ProjectPriority })}
                      className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30"
                      style={inputStyle}
                    >
                      <option value="reguler">Reguler</option>
                      <option value="standard">Standard</option>
                      <option value="express">Express</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>
                    Deskripsi / Detail Tugas *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-lg outline-none resize-none focus:ring-2 focus:ring-cyan-500/30"
                    style={inputStyle}
                    placeholder="Jelaskan detail tugas / proyek Anda..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl transition-all"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 600,
                    fontSize: "14px",
                    background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                    color: "white",
                    boxShadow: "0 4px 16px rgba(6,182,212,0.25)",
                  }}
                >
                  <MessageCircle size={16} />
                  Kirim Pesanan
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { label: "Semua", value: "semua" as const },
            { label: "Menunggu", value: "kosong" as const },
            { label: "Dikerjakan", value: "dalam_pengerjaan" as const },
            { label: "Selesai", value: "selesai" as const },
            { label: "Dibatalkan", value: "dibatalkan" as const },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className="px-4 py-2 rounded-lg transition-all"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
                fontWeight: 600,
                background: filter === tab.value ? "linear-gradient(135deg, #06b6d4, #0891b2)" : "rgba(148,163,184,0.08)",
                border: filter === tab.value ? "none" : "1px solid rgba(148,163,184,0.1)",
                color: filter === tab.value ? "white" : "#94a3b8",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {filtered.length === 0 ? (
          <div
            className="text-center py-20 rounded-2xl border"
            style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}
          >
            <Package size={48} className="mx-auto mb-4" style={{ color: "#334155" }} />
            <h3 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "18px", color: "#64748b" }}>
              {filter === "semua" ? "Belum ada pesanan" : "Tidak ada pesanan dengan status ini"}
            </h3>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#475569", marginTop: "8px" }}>
              Klik "Pesanan Baru" untuk membuat pesanan pertama Anda
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((project) => {
              const status = statusConfig[project.status];
              const priority = priorityConfig[project.priority];
              const StatusIcon = status.icon;
              const isExpanded = expandedId === project.id;

              return (
                <div
                  key={project.id}
                  className="rounded-xl border overflow-hidden transition-all"
                  style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}
                >
                  {/* Main Row */}
                  <div
                    className="p-5 flex items-center gap-4 cursor-pointer hover:bg-white/[0.02] transition-all"
                    onClick={() => setExpandedId(isExpanded ? null : project.id)}
                  >
                    {/* Status Icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: status.bgColor }}
                    >
                      <StatusIcon size={18} style={{ color: status.color }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3
                          className="truncate"
                          style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "15px", color: "#f1f5f9" }}
                        >
                          {project.projectName}
                        </h3>
                        {project.isApproved && (
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", letterSpacing: "0.5px" }}
                          >
                            DIKONFIRMASI
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b" }}>
                          {project.service}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded"
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            fontFamily: "Inter, sans-serif",
                            background: status.bgColor,
                            color: status.color,
                          }}
                        >
                          {status.label}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded"
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            fontFamily: "Inter, sans-serif",
                            color: priority.color,
                          }}
                        >
                          {priority.label}
                        </span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="hidden sm:block text-right shrink-0">
                      <div style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "18px", color: status.color }}>
                        {project.progress}%
                      </div>
                      <div className="w-24 h-1.5 rounded-full mt-1" style={{ background: "rgba(148,163,184,0.1)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${project.progress}%`, background: status.color }}
                        />
                      </div>
                    </div>

                    {/* Expand Arrow */}
                    <div style={{ color: "#64748b" }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div
                      className="px-5 pb-5 space-y-4"
                      style={{ borderTop: "1px solid rgba(148,163,184,0.06)" }}
                    >
                      {/* Progress Bar (mobile) */}
                      <div className="sm:hidden pt-4">
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b" }}>Progress</span>
                          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "14px", color: status.color }}>
                            {project.progress}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ background: "rgba(148,163,184,0.1)" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${project.progress}%`, background: status.color }}
                          />
                        </div>
                      </div>

                      {/* Detail Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                        <div>
                          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "1px" }}>
                            Deadline
                          </span>
                          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#f1f5f9", marginTop: "4px" }}>
                            {project.deadline || "Belum ditentukan"}
                          </p>
                        </div>
                        <div>
                          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "1px" }}>
                            Harga
                          </span>
                          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#f1f5f9", marginTop: "4px" }}>
                            {project.price > 0 ? formatRupiah(project.price) : "Menunggu penawaran"}
                          </p>
                        </div>
                        <div>
                          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "1px" }}>
                            Dibuat
                          </span>
                          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#f1f5f9", marginTop: "4px" }}>
                            {project.createdAt}
                          </p>
                        </div>
                        <div>
                          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "1px" }}>
                            Update Terakhir
                          </span>
                          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#f1f5f9", marginTop: "4px" }}>
                            {project.updatedAt}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      {project.description && (
                        <div className="pt-2">
                          <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "1px" }}>
                            Deskripsi
                          </span>
                          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", lineHeight: 1.7, color: "#94a3b8", marginTop: "4px" }}>
                            {project.description}
                          </p>
                        </div>
                      )}

                      {/* Status Timeline */}
                      <div className="pt-2">
                        <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "1px" }}>
                          Status Pengerjaan
                        </span>
                        <div className="flex items-center gap-0 mt-3">
                          {["kosong", "dalam_pengerjaan", "selesai"].map((step, i) => {
                            const stepConfig = statusConfig[step as ProjectStatus];
                            const stepOrder = { kosong: 0, dalam_pengerjaan: 1, selesai: 2, dibatalkan: -1 };
                            const currentOrder = stepOrder[project.status];
                            const thisOrder = stepOrder[step as ProjectStatus];
                            const isActive = currentOrder >= thisOrder && project.status !== "dibatalkan";
                            const labels = ["Diterima", "Dikerjakan", "Selesai"];

                            return (
                              <div key={step} className="flex items-center flex-1">
                                <div className="flex flex-col items-center">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center"
                                    style={{
                                      background: isActive ? stepConfig.bgColor : "rgba(148,163,184,0.08)",
                                      border: `2px solid ${isActive ? stepConfig.color : "rgba(148,163,184,0.15)"}`,
                                    }}
                                  >
                                    {isActive ? (
                                      <CheckCircle2 size={14} style={{ color: stepConfig.color }} />
                                    ) : (
                                      <div className="w-2 h-2 rounded-full" style={{ background: "rgba(148,163,184,0.3)" }} />
                                    )}
                                  </div>
                                  <span
                                    className="mt-1.5"
                                    style={{
                                      fontFamily: "Inter, sans-serif",
                                      fontSize: "11px",
                                      fontWeight: isActive ? 600 : 400,
                                      color: isActive ? stepConfig.color : "#475569",
                                    }}
                                  >
                                    {labels[i]}
                                  </span>
                                </div>
                                {i < 2 && (
                                  <div
                                    className="flex-1 h-0.5 mx-2"
                                    style={{
                                      background: isActive && currentOrder > thisOrder ? stepConfig.color : "rgba(148,163,184,0.1)",
                                    }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {project.status === "dibatalkan" && (
                          <p className="mt-3" style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#ef4444" }}>
                            Pesanan ini telah dibatalkan
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        {/* Cancel — only if not approved and status is kosong */}
                        {project.status === "kosong" && !project.isApproved && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCancel(project.id); }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all hover:bg-red-500/10"
                            style={{
                              fontFamily: "Inter, sans-serif",
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#ef4444",
                              border: "1px solid rgba(239,68,68,0.2)",
                            }}
                          >
                            <XCircle size={14} />
                            Batalkan
                          </button>
                        )}

                        {/* Delete — only if selesai or dibatalkan */}
                        {(project.status === "selesai" || project.status === "dibatalkan") && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all hover:bg-red-500/10"
                            style={{
                              fontFamily: "Inter, sans-serif",
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#94a3b8",
                              border: "1px solid rgba(148,163,184,0.15)",
                            }}
                          >
                            <Trash2 size={14} />
                            Hapus dari Daftar
                          </button>
                        )}

                        {/* Contact Admin via WhatsApp */}
                        <a
                          href={`https://wa.me/6285954092060?text=${encodeURIComponent(`Halo Admin, saya ingin bertanya tentang pesanan "${project.projectName}"`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all hover:bg-cyan-500/10"
                          style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#06b6d4",
                            border: "1px solid rgba(6,182,212,0.2)",
                          }}
                        >
                          <MessageCircle size={14} />
                          Hubungi Admin
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
