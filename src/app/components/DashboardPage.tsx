import { useState, useEffect } from "react";
import {
  Activity,
  Clock,
  Database,
  Wifi,
  BookOpen,
  TrendingUp,
  Star,
  Search,
} from "lucide-react";

const API_BASE = "/api";

interface HealthData {
  status: string;
  uptime: number;
  timestamp: string;
  cache: { total: number; active: number; expired: number };
}

interface EndpointStatus {
  name: string;
  path: string;
  status: "idle" | "loading" | "success" | "error";
  responseTime?: number;
  dataCount?: number;
}

const ENDPOINTS: EndpointStatus[] = [
  { name: "Latest", path: "/terbaru?page=1", status: "idle" },
  { name: "Popular", path: "/popular", status: "idle" },
  { name: "Recommended", path: "/recommended", status: "idle" },
  { name: "Search", path: "/search?keyword=solo", status: "idle" },
  { name: "Genres", path: "/genre", status: "idle" },
  { name: "Health", path: "/health", status: "idle" },
];

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [endpoints, setEndpoints] = useState(ENDPOINTS);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  async function checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setHealth(data);
      setServerOnline(true);
    } catch {
      setServerOnline(false);
    }
  }

  async function testEndpoint(index: number) {
    const ep = endpoints[index];
    const updated = [...endpoints];
    updated[index] = { ...ep, status: "loading" };
    setEndpoints(updated);

    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}${ep.path}`);
      const data = await res.json();
      const responseTime = Date.now() - start;
      const dataCount = Array.isArray(data.data)
        ? data.data.length
        : data.data
        ? 1
        : 0;
      updated[index] = {
        ...ep,
        status: "success",
        responseTime,
        dataCount,
      };
    } catch {
      updated[index] = {
        ...ep,
        status: "error",
        responseTime: Date.now() - start,
      };
    }
    setEndpoints([...updated]);
  }

  async function testAll() {
    for (let i = 0; i < endpoints.length; i++) {
      await testEndpoint(i);
    }
  }

  const iconMap: Record<string, React.ReactNode> = {
    Latest: <BookOpen className="w-4 h-4" />,
    Popular: <TrendingUp className="w-4 h-4" />,
    Recommended: <Star className="w-4 h-4" />,
    Search: <Search className="w-4 h-4" />,
    Genres: <Database className="w-4 h-4" />,
    Health: <Activity className="w-4 h-4" />,
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-base-white">Dashboard</h2>
        <p className="text-general-300 text-sm mt-1">
          Monitor API status dan performance
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          icon={<Wifi className="w-5 h-5" />}
          label="Server Status"
          value={
            serverOnline === null
              ? "Checking..."
              : serverOnline
              ? "Online"
              : "Offline"
          }
          color={
            serverOnline === null
              ? "text-yellow-400"
              : serverOnline
              ? "text-green-400"
              : "text-red-400"
          }
        />
        <StatusCard
          icon={<Clock className="w-5 h-5" />}
          label="Uptime"
          value={health ? formatUptime(health.uptime) : "-"}
          color="text-primary-500"
        />
        <StatusCard
          icon={<Database className="w-5 h-5" />}
          label="Cache Entries"
          value={health ? String(health.cache.active) : "-"}
          color="text-purple-400"
        />
        <StatusCard
          icon={<Activity className="w-5 h-5" />}
          label="Provider"
          value="shinigami.asia"
          color="text-orange-400"
        />
      </div>

      {/* Endpoint Testing */}
      <div className="bg-base-bg rounded-xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-base-white">
            API Endpoints
          </h3>
          <button
            onClick={testAll}
            className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
          >
            Test All
          </button>
        </div>
        <div className="divide-y divide-white/5">
          {endpoints.map((ep, i) => (
            <div
              key={ep.name}
              className="px-6 py-3 flex items-center gap-4 hover:bg-base-card/30 transition-colors"
            >
              <div className="text-general-300">{iconMap[ep.name]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-base-white">
                  {ep.name}
                </div>
                <div className="text-xs text-general-300 truncate">
                  GET {ep.path}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {ep.responseTime !== undefined && (
                  <span className="text-xs text-general-300">
                    {ep.responseTime}ms
                  </span>
                )}
                {ep.dataCount !== undefined && (
                  <span className="text-xs text-general-300">
                    {ep.dataCount} items
                  </span>
                )}
                <StatusBadge status={ep.status} />
                <button
                  onClick={() => testEndpoint(i)}
                  disabled={ep.status === "loading"}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-white/10 text-general-300 hover:text-base-white hover:border-white/20 transition-colors disabled:opacity-50"
                >
                  Test
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Info */}
      <div className="bg-base-bg rounded-xl border border-white/10 p-6">
        <h3 className="text-lg font-semibold text-base-white mb-4">
          Informasi API
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <InfoRow label="Base URL" value="http://localhost:3001" />
          <InfoRow label="Provider" value="09.shinigami.asia" />
          <InfoRow label="Cache TTL" value="5-60 menit (per endpoint)" />
          <InfoRow label="Format" value="JSON" />
          <InfoRow label="Auth" value="Tidak perlu" />
          <InfoRow label="CORS" value="Enabled (semua origin)" />
        </div>
      </div>
    </div>
  );
}

function StatusCard({
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
        <div className={`${color}`}>{icon}</div>
        <div>
          <div className="text-xs text-general-300">{label}</div>
          <div className={`text-lg font-semibold ${color}`}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    idle: "bg-gray-500/10 text-gray-400",
    loading: "bg-yellow-500/10 text-yellow-400",
    success: "bg-green-500/10 text-green-400",
    error: "bg-red-500/10 text-red-400",
  };
  const labels: Record<string, string> = {
    idle: "Idle",
    loading: "Testing...",
    success: "OK",
    error: "Error",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-white/5">
      <span className="text-general-300">{label}</span>
      <span className="text-base-white font-medium">{value}</span>
    </div>
  );
}
