import { useState } from "react";
import { Plus, Search, Pencil, Trash2, X, ToggleLeft, ToggleRight } from "lucide-react";
import { useAdmin, formatRupiah, type ServiceItem } from "./AdminContext";

const categoryOptions = ["Web", "Mobile", "Design", "Academic", "Backend", "Maintenance"];
const iconOptions = ["Globe", "Smartphone", "Palette", "Code", "BookOpen", "Server", "Bug", "Plug", "Cpu", "Database", "Shield", "Zap"];

export default function ServicesPage() {
  const { services, addService, updateService, deleteService } = useAdmin();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    basePrice: 0,
    category: "Web",
    isActive: true,
    icon: "Globe",
  });

  const filtered = services.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
  });

  const resetForm = () => {
    setFormData({ name: "", description: "", basePrice: 0, category: "Web", isActive: true, icon: "Globe" });
    setEditingService(null);
  };

  const openAdd = () => { resetForm(); setShowModal(true); };
  const openEdit = (s: ServiceItem) => {
    setEditingService(s);
    setFormData({ name: s.name, description: s.description, basePrice: s.basePrice, category: s.category, isActive: s.isActive, icon: s.icon });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingService) {
      updateService(editingService.id, formData);
    } else {
      addService(formData);
    }
    setShowModal(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm("Yakin ingin menghapus layanan ini?")) deleteService(id);
  };

  const toggleActive = (s: ServiceItem) => {
    updateService(s.id, { isActive: !s.isActive });
  };

  const inputStyle = {
    fontFamily: "Inter, sans-serif",
    fontSize: "14px",
    color: "#f1f5f9",
    background: "rgba(15,23,42,0.5)",
    border: "1px solid rgba(148,163,184,0.1)",
  };

  const categoryColors: Record<string, string> = {
    Web: "#06b6d4",
    Mobile: "#8b5cf6",
    Design: "#f59e0b",
    Academic: "#22c55e",
    Backend: "#3b82f6",
    Maintenance: "#ec4899",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "24px", color: "#f1f5f9" }}>
            Layanan
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
            Kelola daftar layanan joki tugas yang tersedia
          </p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 600, background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>
          <Plus size={18} /> Tambah Layanan
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }} />
        <input type="text" placeholder="Cari layanan..." value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-80 pl-10 pr-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} />
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(s => {
          const catColor = categoryColors[s.category] || "#06b6d4";
          return (
            <div key={s.id} className="rounded-xl border p-5 transition-all hover:-translate-y-0.5 group" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)", opacity: s.isActive ? 1 : 0.6 }}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: `${catColor}15` }}>
                  <span style={{ fontSize: "18px" }}>
                    {s.icon === "Globe" && "🌐"}
                    {s.icon === "Smartphone" && "📱"}
                    {s.icon === "Palette" && "🎨"}
                    {s.icon === "Code" && "💻"}
                    {s.icon === "BookOpen" && "📚"}
                    {s.icon === "Server" && "🖥️"}
                    {s.icon === "Bug" && "🐛"}
                    {s.icon === "Plug" && "🔌"}
                    {s.icon === "Cpu" && "⚙️"}
                    {s.icon === "Database" && "🗄️"}
                    {s.icon === "Shield" && "🛡️"}
                    {s.icon === "Zap" && "⚡"}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => toggleActive(s)} className="w-7 h-7 rounded flex items-center justify-center" style={{ color: s.isActive ? "#22c55e" : "#94a3b8" }} title={s.isActive ? "Nonaktifkan" : "Aktifkan"}>
                    {s.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => openEdit(s)} className="w-7 h-7 rounded flex items-center justify-center" style={{ color: "#06b6d4" }} title="Edit"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(s.id)} className="w-7 h-7 rounded flex items-center justify-center" style={{ color: "#ef4444" }} title="Hapus"><Trash2 size={14} /></button>
                </div>
              </div>
              <h3 className="mb-1" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "15px", color: "#f1f5f9" }}>{s.name}</h3>
              <p className="mb-3 line-clamp-2" style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", lineHeight: 1.6, color: "#64748b" }}>{s.description}</p>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full" style={{ fontSize: "10px", fontWeight: 600, background: `${catColor}15`, color: catColor, border: `1px solid ${catColor}30` }}>
                  {s.category}
                </span>
                <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "13px", fontWeight: 600, color: "#22c55e" }}>
                  {formatRupiah(s.basePrice)}+
                </span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border p-12 text-center" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b" }}>Tidak ada layanan ditemukan.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => { setShowModal(false); resetForm(); }} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-8" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "20px", color: "#f1f5f9" }}>
                {editingService ? "Edit Layanan" : "Tambah Layanan Baru"}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} style={{ color: "#94a3b8" }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Nama Layanan</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} required />
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Deskripsi</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-4 py-2.5 rounded-lg outline-none resize-none" style={inputStyle} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Harga Mulai (Rp)</label>
                  <input type="number" value={formData.basePrice} onChange={e => setFormData({ ...formData, basePrice: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-lg outline-none" style={inputStyle} required />
                </div>
                <div>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Kategori</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none" style={inputStyle}>
                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Icon</label>
                <div className="flex flex-wrap gap-2">
                  {iconOptions.map(icon => (
                    <button key={icon} type="button" onClick={() => setFormData({ ...formData, icon })} className="w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all" style={{ background: formData.icon === icon ? "rgba(6,182,212,0.2)" : "rgba(15,23,42,0.5)", border: formData.icon === icon ? "2px solid #06b6d4" : "1px solid rgba(148,163,184,0.1)" }}>
                      {icon === "Globe" && "🌐"}
                      {icon === "Smartphone" && "📱"}
                      {icon === "Palette" && "🎨"}
                      {icon === "Code" && "💻"}
                      {icon === "BookOpen" && "📚"}
                      {icon === "Server" && "🖥️"}
                      {icon === "Bug" && "🐛"}
                      {icon === "Plug" && "🔌"}
                      {icon === "Cpu" && "⚙️"}
                      {icon === "Database" && "🗄️"}
                      {icon === "Shield" && "🛡️"}
                      {icon === "Zap" && "⚡"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setFormData({ ...formData, isActive: !formData.isActive })} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: formData.isActive ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.15)", color: formData.isActive ? "#22c55e" : "#94a3b8", border: `1px solid ${formData.isActive ? "rgba(34,197,94,0.3)" : "rgba(148,163,184,0.3)"}` }}>
                  {formData.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {formData.isActive ? "Aktif" : "Nonaktif"}
                </button>
              </div>

              <button type="submit" className="w-full py-3 rounded-xl transition-all mt-2" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "14px", background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>
                {editingService ? "Update Layanan" : "Tambah Layanan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
