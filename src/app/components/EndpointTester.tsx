import { useState } from "react";
import {
  Play,
  Copy,
  ChevronDown,
  Code2,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";

const API_BASE = "/api";

interface EndpointConfig {
  label: string;
  method: string;
  path: string;
  params?: { name: string; type: string; default?: string; required?: boolean }[];
  description: string;
}

const ENDPOINTS: EndpointConfig[] = [
  {
    label: "Komik Terbaru",
    method: "GET",
    path: "/terbaru",
    params: [{ name: "page", type: "number", default: "1" }],
    description: "Mendapatkan daftar komik terbaru",
  },
  {
    label: "Komik Popular",
    method: "GET",
    path: "/popular",
    description: "Mendapatkan daftar komik populer",
  },
  {
    label: "Recommended",
    method: "GET",
    path: "/recommended",
    description: "Mendapatkan komik yang direkomendasikan",
  },
  {
    label: "Cari Komik",
    method: "GET",
    path: "/search",
    params: [
      { name: "keyword", type: "string", required: true },
      { name: "page", type: "number", default: "1" },
    ],
    description: "Mencari komik berdasarkan keyword",
  },
  {
    label: "Detail Komik",
    method: "GET",
    path: "/detail/{slug}",
    params: [{ name: "slug", type: "string", required: true }],
    description: "Detail komik termasuk daftar chapter (slug = manga_id UUID)",
  },
  {
    label: "Baca Chapter",
    method: "GET",
    path: "/read/{slug}",
    params: [{ name: "slug", type: "string", required: true }],
    description: "Mendapatkan gambar chapter (slug = chapter_id UUID)",
  },
  {
    label: "Daftar Genre",
    method: "GET",
    path: "/genre",
    description: "Mendapatkan semua genre",
  },
  {
    label: "Komik per Genre",
    method: "GET",
    path: "/genre/{slug}",
    params: [
      { name: "slug", type: "string", required: true },
      { name: "page", type: "number", default: "1" },
    ],
    description: "Mendapatkan komik berdasarkan genre (slug = genre name lowercase)",
  },
];

export default function EndpointTester() {
  const [selected, setSelected] = useState(0);
  const [params, setParams] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const endpoint = ENDPOINTS[selected];

  function buildUrl(): string {
    let path = endpoint.path;
    const queryParams: string[] = [];

    endpoint.params?.forEach((p) => {
      const val = params[p.name] || p.default || "";
      if (path.includes(`{${p.name}}`)) {
        path = path.replace(`{${p.name}}`, encodeURIComponent(val));
      } else if (val) {
        queryParams.push(`${p.name}=${encodeURIComponent(val)}`);
      }
    });

    const qs = queryParams.length ? `?${queryParams.join("&")}` : "";
    return `${API_BASE}${path}${qs}`;
  }

  async function executeRequest() {
    setLoading(true);
    setStatus("idle");
    setResponse("");

    const url = buildUrl();
    const start = Date.now();

    try {
      const res = await fetch(url);
      const data = await res.json();
      setResponseTime(Date.now() - start);
      setResponse(JSON.stringify(data, null, 2));
      setStatus(res.ok ? "success" : "error");
    } catch (err) {
      setResponseTime(Date.now() - start);
      setResponse(
        JSON.stringify({ error: String(err) }, null, 2)
      );
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  function copyResponse() {
    if (response) navigator.clipboard.writeText(response);
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-base-white">Endpoint Tester</h2>
        <p className="text-general-300 text-sm mt-1">
          Tes API endpoints secara interaktif
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left - Config */}
        <div className="lg:col-span-2 space-y-4">
          {/* Endpoint Selector */}
          <div className="bg-base-bg rounded-xl border border-white/10 p-4 space-y-4">
            <label className="text-sm font-medium text-general-300">
              Endpoint
            </label>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-base-card rounded-lg border border-white/10 text-base-white text-sm hover:border-white/20 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-green-500/10 text-green-400">
                    {endpoint.method}
                  </span>
                  {endpoint.label}
                </span>
                <ChevronDown className="w-4 h-4 text-general-300" />
              </button>
              {showDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-base-card rounded-lg border border-white/10 shadow-lg overflow-hidden">
                  {ENDPOINTS.map((ep, i) => (
                    <button
                      key={ep.path}
                      onClick={() => {
                        setSelected(i);
                        setParams({});
                        setShowDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2 ${
                        i === selected
                          ? "text-primary-500 bg-primary-500/5"
                          : "text-base-white"
                      }`}
                    >
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-green-500/10 text-green-400">
                        {ep.method}
                      </span>
                      {ep.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="text-xs text-general-300 bg-base-card rounded-lg p-3 font-mono">
              {endpoint.method} {endpoint.path}
            </div>

            <p className="text-xs text-general-300">{endpoint.description}</p>

            {/* Params */}
            {endpoint.params && endpoint.params.length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-general-300">
                  Parameters
                </label>
                {endpoint.params.map((p) => (
                  <div key={p.name}>
                    <label className="text-xs text-general-300 mb-1 block">
                      {p.name}
                      {p.required && (
                        <span className="text-red-400 ml-1">*</span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder={p.default || p.name}
                      value={params[p.name] || ""}
                      onChange={(e) =>
                        setParams({ ...params, [p.name]: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-base-card border border-white/10 rounded-lg text-sm text-base-white placeholder:text-general-300/50 focus:outline-none focus:border-primary-500/50 transition-colors"
                    />
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={executeRequest}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-500 text-white font-medium text-sm rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {loading ? "Fetching..." : "Send Request"}
            </button>
          </div>
        </div>

        {/* Right - Response */}
        <div className="lg:col-span-3">
          <div className="bg-base-bg rounded-xl border border-white/10 overflow-hidden h-full flex flex-col">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Code2 className="w-4 h-4 text-general-300" />
                <span className="text-sm font-medium text-base-white">
                  Response
                </span>
                {status !== "idle" && (
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      status === "success" ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {status === "success" ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {status === "success" ? "200 OK" : "Error"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {responseTime !== null && (
                  <span className="flex items-center gap-1 text-xs text-general-300">
                    <Clock className="w-3 h-3" />
                    {responseTime}ms
                  </span>
                )}
                <button
                  onClick={copyResponse}
                  disabled={!response}
                  className="text-general-300 hover:text-base-white transition-colors disabled:opacity-30"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              {response ? (
                <pre className="text-xs text-general-300 font-mono whitespace-pre-wrap break-words">
                  {response}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-64 text-general-300/50 text-sm">
                  Klik &quot;Send Request&quot; untuk melihat response
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
