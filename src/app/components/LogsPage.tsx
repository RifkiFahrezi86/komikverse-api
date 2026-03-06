import { useState, useEffect, useRef } from "react";
import { ScrollText, Trash2, Pause, Play, ArrowDown } from "lucide-react";

const API_BASE = "/api";

interface LogEntry {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  cached: boolean;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (paused) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/logs`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.logs)) {
            const newLogs: LogEntry[] = data.logs.map(
              (l: Omit<LogEntry, "id">) => ({
                ...l,
                id: ++idRef.current,
              })
            );
            setLogs((prev) => [...prev, ...newLogs].slice(-500));
          }
        }
      } catch {
        // silently ignore
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [paused]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  function clearLogs() {
    setLogs([]);
  }

  function getStatusColor(status: number) {
    if (status < 300) return "text-green-400";
    if (status < 400) return "text-yellow-400";
    return "text-red-400";
  }

  return (
    <div className="space-y-6 max-w-6xl h-full flex flex-col">
      <div>
        <h2 className="text-2xl font-bold text-base-white">Request Logs</h2>
        <p className="text-general-300 text-sm mt-1">
          Monitor request API secara real-time
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPaused(!paused)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            paused
              ? "bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20"
              : "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/20"
          }`}
        >
          {paused ? (
            <Play className="w-4 h-4" />
          ) : (
            <Pause className="w-4 h-4" />
          )}
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            autoScroll
              ? "bg-primary-500/10 border-primary-500/20 text-primary-500"
              : "bg-base-card border-white/10 text-general-300"
          }`}
        >
          <ArrowDown className="w-4 h-4" />
          Auto-scroll
        </button>
        <button
          onClick={clearLogs}
          className="flex items-center gap-2 px-4 py-2 bg-base-card border border-white/10 text-general-300 hover:text-base-white rounded-lg text-sm font-medium transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
        <span className="text-xs text-general-300 ml-auto">
          {logs.length} entries
        </span>
      </div>

      {/* Log Viewer */}
      <div className="bg-base-bg rounded-xl border border-white/10 flex-1 flex flex-col overflow-hidden min-h-[400px]">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-white/10 text-xs font-medium text-general-300">
          <div className="col-span-2">Time</div>
          <div className="col-span-1">Method</div>
          <div className="col-span-5">Path</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1">Duration</div>
          <div className="col-span-2">Cache</div>
        </div>

        {/* Logs */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto divide-y divide-white/5"
        >
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-general-300/50 gap-2">
              <ScrollText className="w-8 h-8" />
              <span className="text-sm">
                Belum ada log. Kirim request ke API untuk melihat log.
              </span>
              <span className="text-xs">
                Polling setiap 3 detik (jika endpoint /api/logs tersedia)
              </span>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-12 gap-2 px-4 py-2 text-xs hover:bg-base-card/30 transition-colors"
              >
                <div className="col-span-2 text-general-300 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
                <div className="col-span-1">
                  <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-mono">
                    {log.method}
                  </span>
                </div>
                <div className="col-span-5 text-base-white font-mono truncate">
                  {log.path}
                </div>
                <div className={`col-span-1 font-mono ${getStatusColor(log.status)}`}>
                  {log.status}
                </div>
                <div className="col-span-1 text-general-300 font-mono">
                  {log.duration}ms
                </div>
                <div className="col-span-2">
                  {log.cached ? (
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-xs">
                      Cached
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs">
                      Fresh
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
