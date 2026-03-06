import { useState } from "react";
import { Plus, Search, Pencil, Trash2, X, MessageCircle, Mail, Phone } from "lucide-react";
import { useAdmin, formatRupiah, type Customer } from "./AdminContext";

export default function CustomersPage() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useAdmin();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    totalOrders: 0,
    totalSpent: 0,
    joinedAt: new Date().toISOString().split("T")[0],
    lastOrderAt: "",
    notes: "",
  });

  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const totalCustomers = customers.length;
  const totalSpentAll = customers.reduce((a, c) => a + c.totalSpent, 0);
  const avgSpent = totalCustomers > 0 ? totalSpentAll / totalCustomers : 0;
  const totalOrdersAll = customers.reduce((a, c) => a + c.totalOrders, 0);

  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "", totalOrders: 0, totalSpent: 0, joinedAt: new Date().toISOString().split("T")[0], lastOrderAt: "", notes: "" });
    setEditingCustomer(null);
  };

  const openAdd = () => { resetForm(); setShowModal(true); };
  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({ name: c.name, email: c.email, phone: c.phone, totalOrders: c.totalOrders, totalSpent: c.totalSpent, joinedAt: c.joinedAt, lastOrderAt: c.lastOrderAt, notes: c.notes });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, formData);
    } else {
      addCustomer(formData);
    }
    setShowModal(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm("Yakin ingin menghapus pelanggan ini?")) deleteCustomer(id);
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
            Pelanggan
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
            Kelola data pelanggan dan riwayat transaksi
          </p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 600, background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>
          <Plus size={18} /> Tambah Pelanggan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Pelanggan", value: totalCustomers.toString(), color: "#8b5cf6" },
          { label: "Total Pesanan", value: totalOrdersAll.toString(), color: "#06b6d4" },
          { label: "Total Pendapatan", value: formatRupiah(totalSpentAll), color: "#22c55e" },
          { label: "Rata-rata Spend", value: formatRupiah(Math.round(avgSpent)), color: "#f59e0b" },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4 border" style={{ background: "#1e293b", borderColor: `${stat.color}30` }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b" }}>{stat.label}</p>
            <p className="mt-1" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "20px", color: "#f1f5f9" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }} />
        <input type="text" placeholder="Cari pelanggan..." value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-80 pl-10 pr-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-xl border overflow-hidden" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                {["Pelanggan", "Kontak", "Total Order", "Total Spend", "Bergabung", "Catatan", "Aksi"].map(h => (
                  <th key={h} className="text-left px-5 py-4" style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", color: "#64748b", textTransform: "uppercase" as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.04)" }} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)", color: "white" }}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", fontWeight: 500, color: "#f1f5f9" }}>{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5" style={{ fontSize: "12px", color: "#94a3b8" }}><Mail size={12} /> {c.email}</div>
                      <div className="flex items-center gap-1.5" style={{ fontSize: "12px", color: "#94a3b8" }}><Phone size={12} /> {c.phone}</div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "14px", fontWeight: 600, color: "#06b6d4" }}>{c.totalOrders}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "13px", fontWeight: 600, color: "#22c55e" }}>{formatRupiah(c.totalSpent)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#94a3b8" }}>{c.joinedAt}</span>
                  </td>
                  <td className="px-5 py-4 max-w-[200px]">
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b" }} className="line-clamp-1">{c.notes || "-"}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4" }} title="Edit"><Pencil size={14} /></button>
                      <a href={`https://wa.me/${c.phone}`} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(37,211,102,0.1)", color: "#25D366" }} title="WhatsApp"><MessageCircle size={14} /></a>
                      <button onClick={() => handleDelete(c.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }} title="Hapus"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center" style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b" }}>Tidak ada pelanggan ditemukan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(c => (
          <div key={c.id} className="rounded-xl border p-4" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)", color: "white" }}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", fontWeight: 600, color: "#f1f5f9" }}>{c.name}</p>
                  <p style={{ fontSize: "12px", color: "#64748b" }}>{c.email}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4" }}><Pencil size={14} /></button>
                <button onClick={() => handleDelete(c.id)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span style={{ color: "#64748b" }}>Orders:</span> <span style={{ color: "#06b6d4", fontWeight: 600 }}>{c.totalOrders}</span></div>
              <div><span style={{ color: "#64748b" }}>Spent:</span> <span style={{ color: "#22c55e", fontWeight: 600 }}>{formatRupiah(c.totalSpent)}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={() => { setShowModal(false); resetForm(); }} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-8" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "20px", color: "#f1f5f9" }}>
                {editingCustomer ? "Edit Pelanggan" : "Tambah Pelanggan Baru"}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} style={{ color: "#94a3b8" }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { label: "Nama Lengkap", key: "name", type: "text" },
                { label: "Email", key: "email", type: "email" },
                { label: "No. WhatsApp", key: "phone", type: "tel" },
              ].map(field => (
                <div key={field.key}>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>{field.label}</label>
                  <input type={field.type} value={formData[field.key as keyof typeof formData] as string} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none transition-all focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} required />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Total Pesanan</label>
                  <input type="number" value={formData.totalOrders} onChange={e => setFormData({ ...formData, totalOrders: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-lg outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Total Spend (Rp)</label>
                  <input type="number" value={formData.totalSpent} onChange={e => setFormData({ ...formData, totalSpent: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2.5 rounded-lg outline-none" style={inputStyle} />
                </div>
              </div>

              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Catatan</label>
                <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full px-4 py-2.5 rounded-lg outline-none resize-none" style={inputStyle} />
              </div>

              <button type="submit" className="w-full py-3 rounded-xl transition-all mt-2" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "14px", background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>
                {editingCustomer ? "Update Pelanggan" : "Tambah Pelanggan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
