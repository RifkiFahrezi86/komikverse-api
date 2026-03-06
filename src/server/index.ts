import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import routes from "./routes.js";
import { getCacheStats, clearCache, getCache } from "./cache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "3001");
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
const API_SECRET = process.env.API_SECRET || "";

// CORS — restrict origins in production
app.use(cors({
  origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : "*",
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Api-Token", "X-Api-Timestamp"],
}));

app.use(express.json({ limit: "1kb" })); // Block large payloads

// Security headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// Rate limiting (in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW = 60_000;

app.use((req, res, next) => {
  // Skip rate limit for dashboard static files
  if (req.path.startsWith("/dashboard")) return next();

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return next();
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ status: "error", message: "Too many requests. Please wait." });
  }
  next();
});

// Token validation middleware (if API_SECRET is set)
function validateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!API_SECRET) return next();
  // Skip for dashboard, health, logs
  if (req.path.startsWith("/dashboard") || req.path === "/health" || req.path === "/api/health") return next();

  const token = req.headers["x-api-token"] as string;
  const timestamp = req.headers["x-api-timestamp"] as string;
  if (!token || !timestamp) {
    return res.status(403).json({ status: "error", message: "Forbidden" });
  }
  const ts = parseInt(timestamp);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > 300_000) {
    return res.status(403).json({ status: "error", message: "Request expired" });
  }
  const expected = crypto.createHmac("sha256", API_SECRET).update(timestamp).digest("hex").slice(0, 16);
  if (token !== expected) {
    return res.status(403).json({ status: "error", message: "Forbidden" });
  }
  next();
}
app.use(validateToken);

// Input sanitization middleware
app.use((req, res, next) => {
  if (req.path.startsWith("/dashboard")) return next();
  const dangerous = /(<script|javascript:|on\w+=|union\s+select|drop\s+table|--|;.*--|\.\.\/|\.\.\\)/i;
  // Check query params
  for (const val of Object.values(req.query)) {
    if (typeof val === "string" && dangerous.test(val)) {
      return res.status(400).json({ status: "error", message: "Invalid input detected" });
    }
  }
  // Check path params
  if (dangerous.test(req.path)) {
    return res.status(400).json({ status: "error", message: "Invalid input detected" });
  }
  next();
});

// Request logging
interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  cached: boolean;
}

const requestLogs: LogEntry[] = [];
const MAX_LOGS = 500;

app.use((req, res, next) => {
  if (req.path === "/logs" || req.path === "/health") return next();
  const start = Date.now();
  const origJson = res.json.bind(res);
  let wasCached = false;
  // Check if this request will be served from cache
  const cacheKey = req.path.replace(/^\//, "").replace(/\//g, "_");
  if (getCache(cacheKey)) wasCached = true;

  res.json = function (body) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: Date.now() - start,
      cached: wasCached,
    };
    requestLogs.push(entry);
    if (requestLogs.length > MAX_LOGS) requestLogs.splice(0, requestLogs.length - MAX_LOGS);
    return origJson(body);
  };
  next();
});

// API routes
app.use("/api", routes);

// Also keep direct routes for backward compatibility
app.use("/", routes);

// Cache management endpoints
app.get("/cache/stats", (_req, res) => {
  res.json({ status: "success", data: getCacheStats() });
});
app.get("/api/cache/stats", (_req, res) => {
  res.json({ status: "success", data: getCacheStats() });
});

app.post("/cache/clear", (_req, res) => {
  clearCache();
  res.json({ status: "success", message: "Cache cleared" });
});
app.post("/api/cache/clear", (_req, res) => {
  clearCache();
  res.json({ status: "success", message: "Cache cleared" });
});

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cache: getCacheStats(),
  });
});
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cache: getCacheStats(),
  });
});

// Logs endpoint
app.get("/logs", (_req, res) => {
  const recent = requestLogs.slice(-50);
  requestLogs.length = 0;
  res.json({ status: "success", logs: recent });
});
app.get("/api/logs", (_req, res) => {
  const recent = requestLogs.slice(-50);
  requestLogs.length = 0;
  res.json({ status: "success", logs: recent });
});

// Serve dashboard frontend
const distPath = path.resolve(__dirname, "../../dist");
app.use("/dashboard", express.static(distPath));
app.get("/dashboard/:path{.:ext}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});
app.get("/dashboard/tester", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});
app.get("/dashboard/cache", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});
app.get("/dashboard/logs", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Root redirect to dashboard
app.get("/", (_req, res) => {
  res.redirect("/dashboard");
});

app.listen(PORT, () => {
  console.log(`\n🚀 KomikVerse API Server`);
  console.log(`   Running at http://localhost:${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`   Health:    http://localhost:${PORT}/health`);
  console.log(`\n📡 Endpoints:`);
  console.log(`   GET /terbaru?page=1      — Latest comics`);
  console.log(`   GET /popular             — Popular comics`);
  console.log(`   GET /recommended         — Recommended comics`);
  console.log(`   GET /search?keyword=xxx  — Search comics`);
  console.log(`   GET /detail/:mangaId     — Comic detail`);
  console.log(`   GET /read/:chapterId     — Chapter images`);
  console.log(`   GET /genre               — Genre list`);
  console.log(`   GET /genre/:slug?page=1  — Comics by genre`);
  console.log(`   GET /health              — Health check`);
  console.log(`   GET /cache/stats         — Cache statistics`);
  console.log(`   POST /cache/clear        — Clear cache\n`);
});
