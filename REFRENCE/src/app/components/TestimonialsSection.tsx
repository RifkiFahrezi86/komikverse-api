import { useState, useEffect } from "react";
import { Star, Quote, Send, MessageCircle, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { useServices } from "./useServices";

interface Comment {
  id: string;
  customerName: string;
  customerEmail: string;
  service: string;
  rating: number;
  comment: string;
  reply: string;
  isPublished: boolean;
  createdAt: string;
}

const fallbackComments: Comment[] = [
  {
    id: "r1",
    customerName: "Ahmad Rizky",
    customerEmail: "ahmad@email.com",
    service: "Website Development",
    rating: 5,
    comment: "Sangat puas! Website skripsi saya selesai tepat waktu dengan kualitas luar biasa. Tim CodeHelp sangat responsif dan profesional.",
    reply: "Terima kasih banyak, Kak Ahmad! Senang bisa membantu menyelesaikan website skripsinya. Sukses selalu! 🎓",
    isPublished: true,
    createdAt: "2026-03-01",
  },
  {
    id: "r2",
    customerName: "Siti Nurhaliza",
    customerEmail: "siti@email.com",
    service: "Skripsi & Thesis IT",
    rating: 5,
    comment: "Tugas pemrograman Java dikerjakan rapi dan terstruktur. Penjelasannya mudah dipahami. Recommended banget!",
    reply: "Thank you, Kak Siti! Kami selalu berusaha memberikan penjelasan yang mudah dipahami agar bisa jadi bahan belajar juga. 💪",
    isPublished: true,
    createdAt: "2026-03-03",
  },
  {
    id: "r3",
    customerName: "Budi Santoso",
    customerEmail: "budi@email.com",
    service: "Website Development",
    rating: 5,
    comment: "Website company profile kami dibuat modern dan profesional. Harga terjangkau dengan kualitas premium. Pasti order lagi!",
    reply: "Terima kasih atas kepercayaannya, Kak Budi! Ditunggu project berikutnya ya 🚀",
    isPublished: true,
    createdAt: "2026-03-02",
  },
  {
    id: "r4",
    customerName: "Dewi Anggraini",
    customerEmail: "dewi@email.com",
    service: "Mobile App Development",
    rating: 5,
    comment: "Aplikasi Android untuk tugas akhir saya dikerjakan dengan sangat baik. Fitur-fiturnya lengkap dan UI-nya modern. Dosen saya sangat impressed!",
    reply: "Alhamdulillah, Kak Dewi! Senang dengar dosennya terkesan. Semoga tugas akhirnya lancar dan sukses! ✨",
    isPublished: true,
    createdAt: "2026-02-28",
  },
  {
    id: "r5",
    customerName: "Reza Pratama",
    customerEmail: "reza@email.com",
    service: "Tugas Pemrograman",
    rating: 4,
    comment: "Tugas Python dan C++ dikerjakan cepat. Kode rapi dan ada komentar penjelasannya. Sangat membantu untuk belajar juga.",
    reply: "Terima kasih reviewnya, Kak Reza! Memang tujuan kami bukan hanya mengerjakan, tapi juga membantu pemahaman. Semangat belajarnya! 📚",
    isPublished: true,
    createdAt: "2026-02-25",
  },
  {
    id: "r6",
    customerName: "Farah Dina",
    customerEmail: "farah@email.com",
    service: "Database & Backend",
    rating: 5,
    comment: "Database design dan REST API untuk project kampus saya bagus banget. Dokumentasinya juga lengkap. Top service!",
    reply: "",
    isPublished: true,
    createdAt: "2026-02-20",
  },
];

// serviceOptions is now loaded dynamically via useServices hook

const avatarColors = ["#06b6d4", "#8b5cf6", "#f59e0b", "#22c55e", "#ef4444", "#ec4899", "#3b82f6", "#14b8a6"];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function StarRating({ rating, onRate }: { rating: number; onRate: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            size={20}
            className={(hover || rating) >= star ? "fill-yellow-400" : ""}
            style={{ color: (hover || rating) >= star ? "#fbbf24" : "#334155" }}
          />
        </button>
      ))}
    </div>
  );
}

export default function TestimonialsSection() {
  const dynamicServices = useServices();
  const serviceOptions = dynamicServices.map(s => s.name);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const commentsPerPage = 3;
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    service: "Website Development",
    rating: 5,
    comment: "",
  });

  const loadComments = async () => {
    try {
      const res = await fetch("/api/comments");
      const data = await res.json();
      if (res.ok && data.comments && data.comments.length > 0) {
        setComments(data.comments);
      } else {
        setComments(fallbackComments);
      }
    } catch {
      setComments(fallbackComments);
    }
  };

  useEffect(() => {
    loadComments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formData.name,
          customerEmail: formData.email,
          service: formData.service,
          rating: formData.rating,
          comment: formData.comment,
        }),
      });

      if (res.ok) {
        await loadComments();
        const total = comments.length + 1;
        setCurrentPage(Math.ceil(total / commentsPerPage));
      }
    } catch {
      // ignore
    }

    setFormData({ name: "", email: "", service: "Website Development", rating: 5, comment: "" });
    setShowForm(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  const inputStyle = {
    fontFamily: "Inter, sans-serif",
    fontSize: "14px",
    color: "#f1f5f9",
    background: "rgba(15, 23, 42, 0.5)",
    border: "1px solid rgba(148,163,184,0.12)",
  };

  return (
    <section id="testimoni" className="py-20 md:py-28" style={{ background: "#1e293b" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span
            className="inline-block px-4 py-1.5 rounded-full mb-4"
            style={{
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.2)",
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "12px",
              letterSpacing: "2px",
              color: "#22c55e",
            }}
          >
            TESTIMONI
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
            Apa Kata <span style={{ color: "#22c55e" }}>Mereka</span>
          </h2>
          <p
            className="max-w-xl mx-auto mb-6"
            style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#64748b" }}
          >
            Testimoni dari klien yang sudah menggunakan layanan kami
          </p>

          {/* Toggle Form Button */}
          {!showForm && !submitted && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all"
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: "13px",
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                color: "white",
                boxShadow: "0 4px 16px rgba(34,197,94,0.25)",
              }}
            >
              <MessageCircle size={16} />
              Tulis Testimoni
            </button>
          )}

          {/* Success Message */}
          {submitted && (
            <div
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl"
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.2)",
                fontFamily: "Inter, sans-serif",
                fontSize: "14px",
                fontWeight: 500,
                color: "#22c55e",
              }}
            >
              <Star size={16} className="fill-green-400" />
              Terima kasih! Testimoni Anda berhasil ditambahkan.
            </div>
          )}
        </div>

        {/* Comment Form */}
        {showForm && (
          <div
            className="max-w-2xl mx-auto mb-12 rounded-2xl border p-6 md:p-8"
            style={{ background: "#0f172a", borderColor: "rgba(148,163,184,0.08)" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3
                style={{
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 600,
                  fontSize: "18px",
                  color: "#f1f5f9",
                }}
              >
                Tulis Testimoni Anda
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-white transition-colors"
                style={{ fontFamily: "Inter, sans-serif", fontSize: "13px" }}
              >
                Batal
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block mb-1.5"
                    style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}
                  >
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-green-500/30"
                    style={inputStyle}
                    placeholder="Nama Anda"
                    required
                  />
                </div>
                <div>
                  <label
                    className="block mb-1.5"
                    style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}
                  >
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-green-500/30"
                    style={inputStyle}
                    placeholder="email@contoh.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label
                    className="block mb-1.5"
                    style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}
                  >
                    Layanan yang Digunakan *
                  </label>
                  <select
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg outline-none focus:ring-2 focus:ring-green-500/30"
                    style={inputStyle}
                  >
                    {serviceOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    className="block mb-1.5"
                    style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}
                  >
                    Rating *
                  </label>
                  <StarRating rating={formData.rating} onRate={(r) => setFormData({ ...formData, rating: r })} />
                </div>
              </div>

              <div>
                <label
                  className="block mb-1.5"
                  style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", fontWeight: 500, color: "#94a3b8" }}
                >
                  Testimoni Anda *
                </label>
                <textarea
                  value={formData.comment}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-lg outline-none resize-none focus:ring-2 focus:ring-green-500/30"
                  style={inputStyle}
                  placeholder="Ceritakan pengalaman Anda menggunakan layanan kami..."
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
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  color: "white",
                  boxShadow: "0 4px 16px rgba(34,197,94,0.25)",
                }}
              >
                <Send size={16} />
                Kirim Testimoni
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {comments
            .slice((currentPage - 1) * commentsPerPage, currentPage * commentsPerPage)
            .map((t) => {
            const initials = getInitials(t.customerName);
            const color = getAvatarColor(t.customerName);
            return (
              <div
                key={t.id}
                className="rounded-xl p-7 border relative transition-all hover:-translate-y-1"
                style={{ background: "#0f172a", borderColor: "rgba(148,163,184,0.08)" }}
              >
                <Quote
                  size={36}
                  style={{ color: `${color}15`, position: "absolute", top: 24, right: 24 }}
                />
                <div className="flex items-center gap-4 mb-5">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 700,
                      fontSize: "14px",
                    }}
                  >
                    {initials}
                  </div>
                  <div>
                    <h4
                      style={{
                        fontFamily: "Space Grotesk, sans-serif",
                        fontWeight: 600,
                        fontSize: "14px",
                        color: "#f1f5f9",
                      }}
                    >
                      {t.customerName}
                    </h4>
                    <p style={{ fontFamily: "Inter, sans-serif", fontSize: "12px", color: "#64748b" }}>
                      {t.service}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} size={14} className="fill-yellow-400" style={{ color: "#fbbf24" }} />
                  ))}
                  {Array.from({ length: 5 - t.rating }).map((_, i) => (
                    <Star key={`e${i}`} size={14} style={{ color: "#334155" }} />
                  ))}
                </div>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", lineHeight: 1.7, color: "#94a3b8" }}>
                  "{t.comment}"
                </p>

                {/* Admin Reply */}
                {t.reply && (
                  <div
                    className="mt-4 pt-4 flex gap-3"
                    style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(6,182,212,0.15)" }}
                    >
                      <Shield size={14} style={{ color: "#06b6d4" }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          style={{
                            fontFamily: "Space Grotesk, sans-serif",
                            fontWeight: 600,
                            fontSize: "12px",
                            color: "#06b6d4",
                          }}
                        >
                          Admin CodeHelp
                        </span>
                        <span
                          className="px-1.5 py-0.5 rounded"
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            fontFamily: "Inter, sans-serif",
                            background: "rgba(6,182,212,0.15)",
                            color: "#06b6d4",
                            letterSpacing: "0.5px",
                          }}
                        >
                          ADMIN
                        </span>
                      </div>
                      <p
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "12px",
                          lineHeight: 1.6,
                          color: "#64748b",
                        }}
                      >
                        {t.reply}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {comments.length > commentsPerPage && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: "rgba(148,163,184,0.08)",
                border: "1px solid rgba(148,163,184,0.1)",
                color: "#94a3b8",
              }}
            >
              <ChevronLeft size={18} />
            </button>

            {Array.from({ length: Math.ceil(comments.length / commentsPerPage) }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className="w-10 h-10 rounded-lg flex items-center justify-center transition-all"
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: currentPage === i + 1
                    ? "linear-gradient(135deg, #06b6d4, #0891b2)"
                    : "rgba(148,163,184,0.08)",
                  border: currentPage === i + 1
                    ? "none"
                    : "1px solid rgba(148,163,184,0.1)",
                  color: currentPage === i + 1 ? "white" : "#94a3b8",
                  boxShadow: currentPage === i + 1 ? "0 4px 12px rgba(6,182,212,0.3)" : "none",
                }}
              >
                {i + 1}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(Math.ceil(comments.length / commentsPerPage), p + 1))}
              disabled={currentPage === Math.ceil(comments.length / commentsPerPage)}
              className="w-10 h-10 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: "rgba(148,163,184,0.08)",
                border: "1px solid rgba(148,163,184,0.1)",
                color: "#94a3b8",
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
