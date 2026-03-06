import { useState } from "react";
import { Send, MessageCircle } from "lucide-react";
import { useServices } from "./useServices";

export default function OrderForm() {
  const services = useServices();
  const [formData, setFormData] = useState({
    nama: "",
    email: "",
    whatsapp: "",
    layanan: "",
    deadline: "",
    budget: "",
    deskripsi: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = `Halo CodeHelp! Saya ingin order:%0A%0ANama: ${formData.nama}%0AEmail: ${formData.email}%0ALayanan: ${formData.layanan}%0ADeadline: ${formData.deadline}%0ABudget: ${formData.budget}%0A%0ADeskripsi: ${formData.deskripsi}`;
    window.open(`https://wa.me/6285954092060?text=${msg}`, "_blank");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const inputStyle = {
    fontFamily: "Inter, sans-serif",
    fontSize: "14px",
    color: "#f1f5f9",
    background: "rgba(15, 23, 42, 0.5)",
    border: "1px solid rgba(148,163,184,0.1)",
  };

  return (
    <section id="kontak" className="py-20 md:py-28" style={{ background: "#1e293b" }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span
            className="inline-block px-4 py-1.5 rounded-full mb-4"
            style={{
              background: "rgba(6,182,212,0.1)",
              border: "1px solid rgba(6,182,212,0.2)",
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "12px",
              letterSpacing: "2px",
              color: "#06b6d4",
            }}
          >
            KONTAK
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
            Form <span style={{ color: "#06b6d4" }}>Pemesanan</span>
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-8 md:p-10 border"
          style={{ background: "#0f172a", borderColor: "rgba(148,163,184,0.08)" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            {[
              { label: "Nama Lengkap", key: "nama", type: "text", placeholder: "Nama lengkap" },
              { label: "Email", key: "email", type: "email", placeholder: "email@contoh.com" },
              { label: "No. WhatsApp", key: "whatsapp", type: "tel", placeholder: "08xxxxxxxxxx" },
            ].map((field) => (
              <div key={field.key}>
                <label
                  className="block mb-2"
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 500,
                    fontSize: "13px",
                    color: "#94a3b8",
                  }}
                >
                  {field.label}
                </label>
                <input
                  type={field.type}
                  required
                  placeholder={field.placeholder}
                  value={formData[field.key as keyof typeof formData]}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg outline-none transition-all focus:ring-2 focus:ring-cyan-500/30"
                  style={inputStyle}
                />
              </div>
            ))}
            <div>
              <label
                className="block mb-2"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  fontSize: "13px",
                  color: "#94a3b8",
                }}
              >
                Jenis Layanan
              </label>
              <select
                required
                value={formData.layanan}
                onChange={(e) => setFormData({ ...formData, layanan: e.target.value })}
                className="w-full px-4 py-3 rounded-lg outline-none transition-all focus:ring-2 focus:ring-cyan-500/30 appearance-none"
                style={inputStyle}
              >
                <option value="">Pilih layanan</option>
                {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label
                className="block mb-2"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  fontSize: "13px",
                  color: "#94a3b8",
                }}
              >
                Deadline
              </label>
              <input
                type="date"
                required
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-4 py-3 rounded-lg outline-none transition-all focus:ring-2 focus:ring-cyan-500/30"
                style={inputStyle}
              />
            </div>
            <div>
              <label
                className="block mb-2"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  fontSize: "13px",
                  color: "#94a3b8",
                }}
              >
                Budget
              </label>
              <select
                required
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                className="w-full px-4 py-3 rounded-lg outline-none transition-all focus:ring-2 focus:ring-cyan-500/30 appearance-none"
                style={inputStyle}
              >
                <option value="">Pilih budget</option>
                <option value="50-150k">Rp 50K - 150K (Reguler)</option>
                <option value="150-500k">Rp 150K - 500K (Standard)</option>
                <option value="500k-2jt">Rp 500K - 2Jt (Express)</option>
                <option value="2jt+">Di atas Rp 2Jt</option>
              </select>
            </div>
          </div>
          <div className="mb-6">
            <label
              className="block mb-2"
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
                fontSize: "13px",
                color: "#94a3b8",
              }}
            >
              Deskripsi Tugas
            </label>
            <textarea
              required
              rows={4}
              value={formData.deskripsi}
              onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
              className="w-full px-4 py-3 rounded-lg outline-none transition-all focus:ring-2 focus:ring-cyan-500/30 resize-none"
              placeholder="Jelaskan detail tugas atau proyek Anda..."
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg transition-all"
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "15px",
              background: submitted
                ? "linear-gradient(135deg, #22c55e, #16a34a)"
                : "linear-gradient(135deg, #06b6d4, #0891b2)",
              color: "white",
              boxShadow: "0 8px 32px rgba(6,182,212,0.25)",
            }}
          >
            {submitted ? (
              <>
                <MessageCircle size={18} /> Mengirim ke WhatsApp...
              </>
            ) : (
              <>
                <Send size={18} /> Kirim Order via WhatsApp
              </>
            )}
          </button>
        </form>
      </div>
    </section>
  );
}
