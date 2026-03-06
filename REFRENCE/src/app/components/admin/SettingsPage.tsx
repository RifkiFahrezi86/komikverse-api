import { useState } from "react";
import { Save, CheckCircle } from "lucide-react";
import { useAdmin } from "./AdminContext";

export default function SettingsPage() {
  const { settings, updateSettings } = useAdmin();
  const [formData, setFormData] = useState({ ...settings });
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle = {
    fontFamily: "Inter, sans-serif",
    fontSize: "14px",
    color: "#f1f5f9",
    background: "rgba(15,23,42,0.5)",
    border: "1px solid rgba(148,163,184,0.1)",
  };

  const labelStyle = {
    fontFamily: "Inter, sans-serif",
    fontSize: "13px",
    fontWeight: 500 as const,
    color: "#94a3b8",
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: "24px", color: "#f1f5f9" }}>
          Pengaturan
        </h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
          Konfigurasi informasi website dan kontak
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General */}
        <div className="rounded-xl border p-6" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
          <h2 className="mb-5" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "16px", color: "#f1f5f9" }}>
            Informasi Umum
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1.5" style={labelStyle}>Nama Website</label>
                <input type="text" value={formData.siteName} onChange={e => setFormData({ ...formData, siteName: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} />
              </div>
              <div>
                <label className="block mb-1.5" style={labelStyle}>Tagline</label>
                <input type="text" value={formData.tagline} onChange={e => setFormData({ ...formData, tagline: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} />
              </div>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="rounded-xl border p-6" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
          <h2 className="mb-5" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "16px", color: "#f1f5f9" }}>
            Hero Section
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block mb-1.5" style={labelStyle}>Judul Hero</label>
              <input type="text" value={formData.heroTitle} onChange={e => setFormData({ ...formData, heroTitle: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} />
            </div>
            <div>
              <label className="block mb-1.5" style={labelStyle}>Subtitle</label>
              <input type="text" value={formData.heroSubtitle} onChange={e => setFormData({ ...formData, heroSubtitle: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} />
            </div>
            <div>
              <label className="block mb-1.5" style={labelStyle}>Deskripsi</label>
              <textarea value={formData.heroDescription} onChange={e => setFormData({ ...formData, heroDescription: e.target.value })} rows={3} className="w-full px-4 py-2.5 rounded-lg outline-none resize-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-xl border p-6" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
          <h2 className="mb-5" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "16px", color: "#f1f5f9" }}>
            Kontak
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1.5" style={labelStyle}>No. Telepon</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} />
              </div>
              <div>
                <label className="block mb-1.5" style={labelStyle}>Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="block mb-1.5" style={labelStyle}>Alamat</label>
              <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} />
            </div>
            <div>
              <label className="block mb-1.5" style={labelStyle}>Nomor WhatsApp (format: 62xxx)</label>
              <input type="text" value={formData.whatsappNumber} onChange={e => setFormData({ ...formData, whatsappNumber: e.target.value })} className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30" style={inputStyle} placeholder="6285954092060" />
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="rounded-xl border p-6" style={{ background: "#1e293b", borderColor: "rgba(148,163,184,0.08)" }}>
          <h2 className="mb-5" style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: "16px", color: "#f1f5f9" }}>
            Media Sosial
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Instagram", key: "instagram" },
              { label: "Facebook", key: "facebook" },
              { label: "Twitter / X", key: "twitter" },
              { label: "GitHub", key: "github" },
            ].map(social => (
              <div key={social.key}>
                <label className="block mb-1.5" style={labelStyle}>{social.label}</label>
                <input
                  type="text"
                  value={(formData.socialLinks as Record<string, string | undefined>)[social.key] || ""}
                  onChange={e => setFormData({ ...formData, socialLinks: { ...formData.socialLinks, [social.key]: e.target.value } })}
                  className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/30"
                  style={inputStyle}
                  placeholder={`https://${social.key}.com/...`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl transition-all"
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            fontSize: "14px",
            background: saved ? "linear-gradient(135deg, #22c55e, #16a34a)" : "linear-gradient(135deg, #06b6d4, #0891b2)",
            color: "white",
            boxShadow: "0 4px 16px rgba(6,182,212,0.2)",
          }}
        >
          {saved ? <><CheckCircle size={18} /> Tersimpan!</> : <><Save size={18} /> Simpan Pengaturan</>}
        </button>
      </form>
    </div>
  );
}
