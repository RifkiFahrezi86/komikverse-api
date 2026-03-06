import { useState, useMemo } from "react";
import { Plus, Search, Pencil, Trash2, X, Star, Eye, EyeOff, MessageSquareText, Database, ChevronDown, UserPlus } from "lucide-react";
import { useAdmin, type Comment } from "./AdminContext";

export default function CommentsPage() {
  const { comments, customers, services, addComment, updateComment, deleteComment, addCustomer, refreshData } = useAdmin();
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterPublished, setFilterPublished] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Customer selector state
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [useCustomName, setUseCustomName] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");

  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    service: "Website Development",
    rating: 5,
    comment: "",
    reply: "",
    isPublished: true,
    createdAt: new Date().toISOString().split("T")[0],
  });

  // Filter customers for dropdown
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  const filtered = comments
    .filter(c => {
      if (filterRating !== null && c.rating !== filterRating) return false;
      if (filterPublished !== null && c.isPublished !== filterPublished) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return c.customerName.toLowerCase().includes(q) || c.comment.toLowerCase().includes(q) || c.service.toLowerCase().includes(q);
    });

  const avgRating = comments.length > 0 ? (comments.reduce((a, c) => a + c.rating, 0) / comments.length).toFixed(1) : "0";
  const publishedCount = comments.filter(c => c.isPublished).length;

  const resetForm = () => {
    setFormData({ customerName: "", customerEmail: "", service: "Website Development", rating: 5, comment: "", reply: "", isPublished: true, createdAt: new Date().toISOString().split("T")[0] });
    setEditingComment(null);
    setCustomerSearch("");
    setSelectedCustomerId(null);
    setUseCustomName(false);
    setShowCustomerDropdown(false);
    setShowCreateCustomer(false);
    setNewCustName("");
    setNewCustEmail("");
  };

  const openAdd = () => { resetForm(); setShowModal(true); };
  const openEdit = (c: Comment) => {
    setEditingComment(c);
    setFormData({ customerName: c.customerName, customerEmail: c.customerEmail, service: c.service, rating: c.rating, comment: c.comment, reply: c.reply, isPublished: c.isPublished, createdAt: c.createdAt });
    setCustomerSearch(c.customerName);
    setUseCustomName(true); // editing uses custom name mode so they can change freely
    setSelectedCustomerId(null);
    setShowModal(true);
  };

  const selectCustomer = (c: { id: string; name: string; email: string }) => {
    setSelectedCustomerId(c.id);
    setCustomerSearch(c.name);
    setFormData(prev => ({ ...prev, customerName: c.name, customerEmail: c.email }));
    setShowCustomerDropdown(false);
    setUseCustomName(false);
  };

  const handleCreateInlineCustomer = () => {
    if (!newCustName.trim()) return;
    addCustomer({ name: newCustName.trim(), email: newCustEmail.trim(), phone: "", totalOrders: 0, totalSpent: 0, joinedAt: new Date().toISOString().split("T")[0], lastOrderAt: "", notes: "" });
    setFormData(prev => ({ ...prev, customerName: newCustName.trim(), customerEmail: newCustEmail.trim() }));
    setCustomerSearch(newCustName.trim());
    setUseCustomName(true);
    setShowCreateCustomer(false);
    setNewCustName("");
    setNewCustEmail("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingComment) {
      updateComment(editingComment.id, formData);
    } else {
      addComment(formData);
    }
    setShowModal(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm("Yakin ingin menghapus komentar ini?")) deleteComment(id);
  };

  const handleReply = (id: string) => {
    updateComment(id, { reply: replyText });
    setReplyingId(null);
    setReplyText("");
  };

  const togglePublish = (c: Comment) => {
    updateComment(c.id, { isPublished: !c.isPublished });
  };

  const handleSeed = async () => {
    if (!confirm("Generate 15 customer & 15-20 testimoni otomatis?")) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        refreshData();
      } else {
        alert("Gagal: " + (data.error || "Unknown error"));
      }
    } catch {
      alert("Gagal menghubungi server");
    } finally {
      setSeeding(false);
    }
  };

  const inputStyle = {
    fontFamily: "Inter, sans-serif",
    fontSize: "14px",
    color: "#f1f5f9",
    background: "rgba(15,23,42,0.5)",
    border: "1px solid rgba(148,163,184,0.1)",
  };

  const StarRating = ({ rating, onChange, size = 20 }: { rating: number; onChange?: (r: number) => void; size?: number }) => (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <button key={i} type="button" onClick={() => onChange?.(i + 1)} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill={i < rating ? "#f59e0b" : "#334155"} xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "24px", color: "#f1f5f9" }}>
            Komentar & Ulasan
          </h1>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
            Kelola ulasan dan testimoni pelanggan
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSeed} disabled={seeding} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all disabled:opacity-50" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 600, background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", color: "white" }}>
            <Database size={18} /> {seeding ? "Generating..." : "Seed Data"}
          </button>
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 600, background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>
            <Plus size={18} /> Tambah Ulasan
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Ulasan", value: comments.length.toString(), color: "#8b5cf6" },
          { label: "Rating Rata-rata", value: avgRating, color: "#f59e0b" },
          { label: "Dipublikasi", value: publishedCount.toString(), color: "#22c55e" },
          { label: "Belum Publish", value: (comments.length - publishedCount).toString(), color: "#94a3b8" },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl p-4 border" style={{ background: "#1e293b", borderColor: `${stat.color}30` }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b" }}>{stat.label}</p>
            <p className="mt-1" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "20px", color: "#f1f5f9" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }} />
          <input type="text" placeholder="Cari komentar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setFilterRating(null)} className="px-3 py-1.5 rounded-lg text-sm" style={{ fontWeight: 500, background: filterRating === null ? "linear-gradient(135deg, #06b6d4, #0891b2)" : "#1e293b", color: filterRating === null ? "white" : "#94a3b8", border: filterRating === null ? "none" : "1px solid rgba(148,163,184,0.08)" }}>
            Semua
          </button>
          {[5, 4, 3, 2, 1].map(r => (
            <button key={r} onClick={() => setFilterRating(filterRating === r ? null : r)} className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1" style={{ fontWeight: 500, background: filterRating === r ? "rgba(245,158,11,0.2)" : "#1e293b", color: filterRating === r ? "#f59e0b" : "#94a3b8", border: filterRating === r ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(148,163,184,0.08)" }}>
              {r} <Star size={12} fill={filterRating === r ? "#f59e0b" : "none"} />
            </button>
          ))}
          <button onClick={() => setFilterPublished(filterPublished === null ? true : filterPublished === true ? false : null)} className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1" style={{ fontWeight: 500, background: filterPublished !== null ? "rgba(34,197,94,0.15)" : "#1e293b", color: filterPublished !== null ? "#22c55e" : "#94a3b8", border: filterPublished !== null ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(148,163,184,0.08)" }}>
            {filterPublished === null ? "Status" : filterPublished ? "Published" : "Draft"}
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {filtered.map(c => (
          <div key={c.id} className="rounded-xl border p-6 transition-all hover:border-slate-600/30" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)", color: "white" }}>
                  {c.customerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", fontWeight: 600, color: "#f1f5f9" }}>{c.customerName}</span>
                    <span className="px-2 py-0.5 rounded-full" style={{ fontSize: "10px", fontWeight: 600, background: c.isPublished ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.15)", color: c.isPublished ? "#22c55e" : "#94a3b8", border: `1px solid ${c.isPublished ? "rgba(34,197,94,0.3)" : "rgba(148,163,184,0.3)"}` }}>
                      {c.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span style={{ fontSize: "12px", color: "#06b6d4" }}>{c.service}</span>
                    <span style={{ fontSize: "12px", color: "#475569" }}>• {c.createdAt}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => togglePublish(c)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: c.isPublished ? "rgba(34,197,94,0.1)" : "rgba(148,163,184,0.1)", color: c.isPublished ? "#22c55e" : "#94a3b8" }} title={c.isPublished ? "Unpublish" : "Publish"}>
                  {c.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4" }} title="Edit"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(c.id)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }} title="Hapus"><Trash2 size={14} /></button>
              </div>
            </div>

            <StarRating rating={c.rating} size={16} />

            <p className="mt-3" style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#cbd5e1", lineHeight: 1.7 }}>{c.comment}</p>

            {/* Reply */}
            {c.reply && (
              <div className="mt-3 ml-4 pl-4 py-3 rounded-lg" style={{ borderLeft: "2px solid rgba(6,182,212,0.3)", background: "rgba(6,182,212,0.05)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageSquareText size={12} style={{ color: "#06b6d4" }} />
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#06b6d4" }}>Balasan Admin</span>
                </div>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#94a3b8", lineHeight: 1.6 }}>{c.reply}</p>
              </div>
            )}

            {/* Reply form */}
            {replyingId === c.id ? (
              <div className="mt-3 flex gap-2">
                <input type="text" placeholder="Tulis balasan..." value={replyText} onChange={e => setReplyText(e.target.value)} className="flex-1 px-3 py-2 rounded-lg outline-none text-sm" style={inputStyle} autoFocus />
                <button onClick={() => handleReply(c.id)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>Kirim</button>
                <button onClick={() => { setReplyingId(null); setReplyText(""); }} className="px-3 py-2 rounded-lg text-sm" style={{ color: "#94a3b8", border: "1px solid rgba(148,163,184,0.1)" }}>Batal</button>
              </div>
            ) : (
              !c.reply && (
                <button onClick={() => { setReplyingId(c.id); setReplyText(""); }} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: "#06b6d4" }}>
                  <MessageSquareText size={14} /> Balas
                </button>
              )
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border p-12 text-center" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b" }}>Tidak ada komentar ditemukan.</p>
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
                {editingComment ? "Edit Ulasan" : "Tambah Ulasan"}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} style={{ color: "#94a3b8" }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer Selector */}
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Pilih Pelanggan</label>
                {!useCustomName ? (
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Cari pelanggan..."
                          value={customerSearch}
                          onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); setSelectedCustomerId(null); }}
                          onFocus={() => setShowCustomerDropdown(true)}
                          className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30 pr-8"
                          style={inputStyle}
                        />
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#64748b" }} />
                      </div>
                      <button type="button" onClick={() => { setUseCustomName(true); setFormData(prev => ({ ...prev, customerName: customerSearch, customerEmail: "" })); }} className="px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap" style={{ background: "rgba(148,163,184,0.1)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.15)" }} title="Ketik nama manual">
                        Manual
                      </button>
                    </div>
                    {showCustomerDropdown && (
                      <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border" style={{ background: "#0f172a", borderColor: "rgba(148,163,184,0.15)" }}>
                        {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                          <button key={c.id} type="button" onClick={() => selectCustomer(c)} className="w-full text-left px-4 py-2.5 transition-colors hover:bg-slate-800 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)", color: "white" }}>
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>{c.name}</div>
                              <div style={{ fontSize: "11px", color: "#64748b" }}>{c.email}</div>
                            </div>
                          </button>
                        )) : (
                          <div className="px-4 py-3 text-center">
                            <p style={{ fontSize: "12px", color: "#64748b" }}>Tidak ditemukan</p>
                            <button type="button" onClick={() => setShowCreateCustomer(true)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium" style={{ color: "#06b6d4" }}>
                              <UserPlus size={12} /> Buat pelanggan baru
                            </button>
                          </div>
                        )}
                        {filteredCustomers.length > 0 && (
                          <button type="button" onClick={() => setShowCreateCustomer(true)} className="w-full text-left px-4 py-2.5 transition-colors hover:bg-slate-800 flex items-center gap-2" style={{ color: "#06b6d4" }}>
                            <UserPlus size={14} /> <span style={{ fontSize: "13px", fontWeight: 500 }}>Buat pelanggan baru</span>
                          </button>
                        )}
                      </div>
                    )}
                    {/* Inline create customer */}
                    {showCreateCustomer && (
                      <div className="mt-2 p-3 rounded-lg border space-y-2" style={{ background: "rgba(6,182,212,0.05)", borderColor: "rgba(6,182,212,0.2)" }}>
                        <p style={{ fontSize: "12px", fontWeight: 600, color: "#06b6d4" }}>Buat Pelanggan Baru</p>
                        <input type="text" placeholder="Nama" value={newCustName} onChange={e => setNewCustName(e.target.value)} className="w-full px-3 py-2 rounded-lg outline-none text-sm" style={inputStyle} />
                        <input type="email" placeholder="Email (opsional)" value={newCustEmail} onChange={e => setNewCustEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg outline-none text-sm" style={inputStyle} />
                        <div className="flex gap-2">
                          <button type="button" onClick={handleCreateInlineCustomer} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>Buat & Pilih</button>
                          <button type="button" onClick={() => setShowCreateCustomer(false)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: "#94a3b8", border: "1px solid rgba(148,163,184,0.1)" }}>Batal</button>
                        </div>
                      </div>
                    )}
                    {selectedCustomerId && (
                      <p className="mt-1.5" style={{ fontSize: "12px", color: "#22c55e" }}>✓ {formData.customerName} — {formData.customerEmail}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Nama pelanggan" value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} className="flex-1 px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} required />
                      <button type="button" onClick={() => { setUseCustomName(false); setCustomerSearch(""); setSelectedCustomerId(null); }} className="px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap" style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.2)" }}>
                        Pilih
                      </button>
                    </div>
                    <input type="email" placeholder="Email pelanggan" value={formData.customerEmail} onChange={e => setFormData({ ...formData, customerEmail: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} />
                  </div>
                )}
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Layanan</label>
                <select value={formData.service} onChange={e => setFormData({ ...formData, service: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none" style={inputStyle}>
                  {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Rating</label>
                <StarRating rating={formData.rating} onChange={r => setFormData({ ...formData, rating: r })} size={24} />
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Komentar</label>
                <textarea value={formData.comment} onChange={e => setFormData({ ...formData, comment: e.target.value })} rows={4} className="w-full px-4 py-2.5 rounded-lg outline-none resize-none" style={inputStyle} required />
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}>Balasan Admin (opsional)</label>
                <textarea value={formData.reply} onChange={e => setFormData({ ...formData, reply: e.target.value })} rows={2} className="w-full px-4 py-2.5 rounded-lg outline-none resize-none" style={inputStyle} />
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setFormData({ ...formData, isPublished: !formData.isPublished })} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: formData.isPublished ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.15)", color: formData.isPublished ? "#22c55e" : "#94a3b8", border: `1px solid ${formData.isPublished ? "rgba(34,197,94,0.3)" : "rgba(148,163,184,0.3)"}` }}>
                  {formData.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                  {formData.isPublished ? "Published" : "Draft"}
                </button>
              </div>

              <button type="submit" className="w-full py-3 rounded-xl transition-all mt-2" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "14px", background: "linear-gradient(135deg, #06b6d4, #0891b2)", color: "white" }}>
                {editingComment ? "Update Ulasan" : "Tambah Ulasan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
