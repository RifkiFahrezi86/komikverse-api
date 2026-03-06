import { useState } from "react";
import { Plus, Pencil, Trash2, X, GripVertical, Check, Star } from "lucide-react";
import { useAdmin, type PricingPlan, type PricingFeature } from "./AdminContext";

const colorOptions = [
  { label: "Cyan", value: "#06b6d4" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Red", value: "#ef4444" },
  { label: "Green", value: "#22c55e" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Pink", value: "#ec4899" },
  { label: "Blue", value: "#3b82f6" },
];

const iconOptions = ["Calendar", "Clock", "Zap", "Star", "Shield", "Rocket", "Crown", "Diamond"];

export default function PricingPage() {
  const { settings, updateSettings } = useAdmin();
  const plans = (settings.pricingPlans || []).sort((a, b) => a.order - b.order);

  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [formData, setFormData] = useState<Omit<PricingPlan, "id">>({
    name: "",
    price: "",
    color: "#06b6d4",
    icon: "Calendar",
    popular: false,
    features: [{ text: "", ok: true }],
    order: 0,
  });

  const resetForm = () => {
    setFormData({ name: "", price: "", color: "#06b6d4", icon: "Calendar", popular: false, features: [{ text: "", ok: true }], order: plans.length + 1 });
    setEditingPlan(null);
  };

  const openAdd = () => {
    resetForm();
    setFormData(prev => ({ ...prev, order: plans.length + 1 }));
    setShowModal(true);
  };

  const openEdit = (plan: PricingPlan) => {
    setEditingPlan(plan);
    setFormData({ name: plan.name, price: plan.price, color: plan.color, icon: plan.icon, popular: plan.popular, features: [...plan.features], order: plan.order });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFeatures = formData.features.filter(f => f.text.trim());
    if (!formData.name.trim() || !formData.price.trim() || cleanFeatures.length === 0) {
      alert("Nama, harga, dan minimal 1 fitur wajib diisi");
      return;
    }

    let newPlans: PricingPlan[];
    if (editingPlan) {
      newPlans = plans.map(p => p.id === editingPlan.id ? { ...p, ...formData, features: cleanFeatures } : p);
    } else {
      const newId = "p" + Date.now();
      newPlans = [...plans, { id: newId, ...formData, features: cleanFeatures }];
    }

    // If this plan is marked popular, unmark others
    if (formData.popular) {
      const currentId = editingPlan?.id || "p" + Date.now();
      newPlans = newPlans.map(p => ({ ...p, popular: p.id === currentId ? true : false }));
    }

    updateSettings({ pricingPlans: newPlans });
    setShowModal(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!confirm("Yakin ingin menghapus paket ini?")) return;
    const newPlans = plans.filter(p => p.id !== id).map((p, i) => ({ ...p, order: i + 1 }));
    updateSettings({ pricingPlans: newPlans });
  };

  const moveUp = (id: string) => {
    const idx = plans.findIndex(p => p.id === id);
    if (idx <= 0) return;
    const newPlans = [...plans];
    [newPlans[idx - 1], newPlans[idx]] = [newPlans[idx], newPlans[idx - 1]];
    updateSettings({ pricingPlans: newPlans.map((p, i) => ({ ...p, order: i + 1 })) });
  };

  const moveDown = (id: string) => {
    const idx = plans.findIndex(p => p.id === id);
    if (idx >= plans.length - 1) return;
    const newPlans = [...plans];
    [newPlans[idx], newPlans[idx + 1]] = [newPlans[idx + 1], newPlans[idx]];
    updateSettings({ pricingPlans: newPlans.map((p, i) => ({ ...p, order: i + 1 })) });
  };

  const addFeature = () => {
    setFormData(prev => ({ ...prev, features: [...prev.features, { text: "", ok: true }] }));
  };

  const removeFeature = (idx: number) => {
    setFormData(prev => ({ ...prev, features: prev.features.filter((_, i) => i !== idx) }));
  };

  const updateFeature = (idx: number, updates: Partial<PricingFeature>) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.map((f, i) => i === idx ? { ...f, ...updates } : f),
    }));
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
            Paket Harga
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
            Kelola paket harga yang ditampilkan di halaman utama
          </p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 600, background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>
          <Plus size={18} /> Tambah Paket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl p-4 border" style={{ background: "#1e293b", borderColor: "rgba(6,182,212,0.3)" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b" }}>Total Paket</p>
          <p className="mt-1" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "20px", color: "#f1f5f9" }}>{plans.length}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#1e293b", borderColor: "rgba(245,158,11,0.3)" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b" }}>Paket Populer</p>
          <p className="mt-1" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "20px", color: "#f1f5f9" }}>{plans.find(p => p.popular)?.name || "-"}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#1e293b", borderColor: "rgba(34,197,94,0.3)" }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b" }}>Total Fitur</p>
          <p className="mt-1" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "20px", color: "#f1f5f9" }}>{plans.reduce((a, p) => a + p.features.length, 0)}</p>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-xl border p-6 relative" style={{ background: "#1e293b", borderColor: `${plan.color}40` }}>
            {plan.popular && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full" style={{ background: plan.color, fontSize: "10px", fontWeight: 700, letterSpacing: "1px", color: "#000" }}>
                POPULER
              </div>
            )}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${plan.color}15` }}>
                    <Star size={16} style={{ color: plan.color }} />
                  </div>
                  <h3 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "18px", color: "#f1f5f9" }}>{plan.name}</h3>
                </div>
                <p style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "16px", color: plan.color }}>{plan.price}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => moveUp(plan.id)} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "rgba(148,163,184,0.1)", color: "#94a3b8" }} title="Geser ke atas">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                </button>
                <button onClick={() => moveDown(plan.id)} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "rgba(148,163,184,0.1)", color: "#94a3b8" }} title="Geser ke bawah">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {plan.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  {f.ok ? <Check size={13} style={{ color: "#22c55e" }} /> : <X size={13} style={{ color: "#475569" }} />}
                  <span style={{ fontSize: "12px", color: f.ok ? "#cbd5e1" : "#475569" }}>{f.text}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-3 border-t" style={{ borderColor: "rgba(148,163,184,0.08)" }}>
              <button onClick={() => openEdit(plan)} className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1" style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4" }}>
                <Pencil size={12} /> Edit
              </button>
              <button onClick={() => handleDelete(plan.id)} className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                <Trash2 size={12} /> Hapus
              </button>
            </div>
          </div>
        ))}

        {plans.length === 0 && (
          <div className="col-span-3 rounded-xl border p-12 text-center" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b" }}>Belum ada paket harga. Klik "Tambah Paket" untuk mulai.</p>
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
                {editingPlan ? "Edit Paket" : "Tambah Paket"}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} style={{ color: "#94a3b8" }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Nama Paket</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} required placeholder="contoh: Reguler, Standard, Express" />
              </div>

              {/* Price */}
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Harga</label>
                <input type="text" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} required placeholder="contoh: Rp 50K - 150K" />
              </div>

              {/* Color */}
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Warna Aksen</label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map(c => (
                    <button key={c.value} type="button" onClick={() => setFormData({ ...formData, color: c.value })} className="w-9 h-9 rounded-lg border-2 transition-all flex items-center justify-center" style={{ background: `${c.value}20`, borderColor: formData.color === c.value ? c.value : "transparent" }}>
                      <div className="w-5 h-5 rounded-full" style={{ background: c.value }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon */}
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Ikon</label>
                <select value={formData.icon} onChange={e => setFormData({ ...formData, icon: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none" style={inputStyle}>
                  {iconOptions.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {/* Popular */}
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setFormData({ ...formData, popular: !formData.popular })} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: formData.popular ? "rgba(245,158,11,0.15)" : "rgba(148,163,184,0.15)", color: formData.popular ? "#f59e0b" : "#94a3b8", border: `1px solid ${formData.popular ? "rgba(245,158,11,0.3)" : "rgba(148,163,184,0.3)"}` }}>
                  <Star size={14} fill={formData.popular ? "#f59e0b" : "none"} />
                  {formData.popular ? "Populer (Ditandai)" : "Tidak Populer"}
                </button>
              </div>

              {/* Features */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Fitur</label>
                  <button type="button" onClick={addFeature} className="text-xs font-medium flex items-center gap-1" style={{ color: "#06b6d4" }}>
                    <Plus size={12} /> Tambah Fitur
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.features.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <button type="button" onClick={() => updateFeature(idx, { ok: !f.ok })} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: f.ok ? "rgba(34,197,94,0.1)" : "rgba(148,163,184,0.1)", color: f.ok ? "#22c55e" : "#94a3b8" }} title={f.ok ? "Tersedia" : "Tidak tersedia"}>
                        {f.ok ? <Check size={14} /> : <X size={14} />}
                      </button>
                      <input type="text" value={f.text} onChange={e => updateFeature(idx, { text: e.target.value })} className="flex-1 px-3 py-2 rounded-lg outline-none text-sm" style={inputStyle} placeholder="Nama fitur..." />
                      {formData.features.length > 1 && (
                        <button type="button" onClick={() => removeFeature(idx)} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full py-3 rounded-xl transition-all mt-2" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "14px", background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>
                {editingPlan ? "Update Paket" : "Tambah Paket"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
