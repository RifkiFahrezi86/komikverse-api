import { useState, useEffect } from "react";
import { Database, Trash2, RefreshCw, HardDrive } from "lucide-react";

const API_BASE = "/api";

interface CacheStats {
  total: number;
  active: number;
  expired: number;
}

export default function CachePage() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setStats(data.cache);
    } catch {
      setStats(null);
    }
  }

  async function clearCache() {
    setClearing(true);
    setMessage("");
    try {
      const res = await fetch(`${API_BASE}/cache/clear`, { method: "POST" });
      const data = await res.json();
      setMessage(data.message || "Cache berhasil dihapus");
      await fetchStats();
    } catch {
      setMessage("Gagal menghapus cache");
    } finally {
      setClearing(false);
    }
  }

  async function refresh() {
    setLoading(true);
    await fetchStats();
    setLoading(false);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-base-white">Cache Manager</h2>
        <p className="text-general-300 text-sm mt-1">
          Monitor dan kelola cache API
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CacheCard
          icon={<Database className="w-5 h-5" />}
          label="Total Entries"
          value={stats ? String(stats.total) : "-"}
          color="text-primary-500"
        />
        <CacheCard
          icon={<HardDrive className="w-5 h-5" />}
          label="Active"
          value={stats ? String(stats.active) : "-"}
          color="text-green-400"
        />
        <CacheCard
          icon={<Database className="w-5 h-5" />}
          label="Expired"
          value={stats ? String(stats.expired) : "-"}
          color="text-yellow-400"
        />
      </div>

      {/* Actions */}
      <div className="bg-base-bg rounded-xl border border-white/10 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-base-white">Aksi</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-base-card border border-white/10 text-general-300 hover:text-base-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh Stats
          </button>
          <button
            onClick={clearCache}
            disabled={clearing}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {clearing ? "Clearing..." : "Clear All Cache"}
          </button>
        </div>
        {message && (
          <div className="text-sm text-green-400 bg-green-500/10 rounded-lg px-4 py-2">
            {message}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-base-bg rounded-xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-base-white mb-4">
          Cache TTL Configuration
        </h3>
        <div className="space-y-2">
          <TTLRow endpoint="GET /terbaru" ttl="10 menit" />
          <TTLRow endpoint="GET /popular" ttl="30 menit" />
          <TTLRow endpoint="GET /recommended" ttl="60 menit" />
          <TTLRow endpoint="GET /search" ttl="10 menit" />
          <TTLRow endpoint="GET /detail/:slug" ttl="30 menit" />
          <TTLRow endpoint="GET /read/:slug" ttl="5 menit" />
          <TTLRow endpoint="GET /genre" ttl="60 menit" />
          <TTLRow endpoint="GET /genre/:slug" ttl="30 menit" />
        </div>
      </div>
    </div>
  );
}

function CacheCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-base-bg rounded-xl border border-white/10 p-4">
      <div className="flex items-center gap-3">
        <div className={color}>{icon}</div>
        <div>
          <div className="text-xs text-general-300">{label}</div>
          <div className={`text-2xl font-bold ${color}`}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function TTLRow({ endpoint, ttl }: { endpoint: string; ttl: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5">
      <span className="text-sm font-mono text-general-300">{endpoint}</span>
      <span className="text-sm text-primary-500 font-medium">{ttl}</span>
    </div>
  );
}
