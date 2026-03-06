import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./lib/db";

let bcrypt: any;
let jwt: any;

async function loadDeps() {
  if (!bcrypt) {
    const b = await import("bcryptjs");
    bcrypt = (b as any).default || b;
  }
  if (!jwt) {
    const j = await import("jsonwebtoken");
    jwt = (j as any).default || j;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "komikverse-secret-key-change-me";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);

interface JwtPayload {
  id: number;
  username: string;
  role: string;
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (ALLOWED_ORIGINS.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function createToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

function getTokenFromRequest(req: VercelRequest): string | null {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  // Check cookie
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/kv_token=([^;]+)/);
  return match ? match[1] : null;
}

function sanitize(str: string): string {
  return str.replace(/[<>"'&]/g, "").trim();
}

// Rate limiting for auth
const authRateLimit = new Map<string, { count: number; resetAt: number }>();
function isAuthRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = authRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    authRateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 10; // 10 auth attempts per minute
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();

  await loadDeps();

  const ip = (typeof req.headers["x-forwarded-for"] === "string"
    ? req.headers["x-forwarded-for"].split(",")[0].trim()
    : "unknown");

  const path = (req.url || "").split("?")[0].replace(/^\/api\/auth\/?/, "");
  const action = path.split("/")[0] || "";
    // GET /api/auth/me
    if (req.method === "GET" && action === "me") {
      const token = getTokenFromRequest(req);
      if (!token) return res.status(401).json({ error: "Not authenticated" });
      const payload = verifyToken(token);
      if (!payload) return res.status(401).json({ error: "Invalid token" });

      const rows = await query(
        "SELECT id, username, email, role, avatar_url, created_at FROM users WHERE id = $1",
        [payload.id]
      );
      if (rows.length === 0) return res.status(401).json({ error: "User not found" });
      return res.status(200).json({ user: rows[0] });
    }

    // PATCH /api/auth/change-password (authenticated)
    if (req.method === "PATCH" && action === "change-password") {
      const token = getTokenFromRequest(req);
      if (!token) return res.status(401).json({ error: "Not authenticated" });
      const payload = verifyToken(token);
      if (!payload) return res.status(401).json({ error: "Invalid token" });

      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const currentPassword = String(body.current_password || "");
      const newPassword = String(body.new_password || "");

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Password lama dan baru diperlukan" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password baru minimal 6 karakter" });
      }

      const rows = await query("SELECT password_hash FROM users WHERE id = $1", [payload.id]);
      if (rows.length === 0) return res.status(404).json({ error: "User not found" });

      const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: "Password lama salah" });

      const newHash = await bcrypt.hash(newPassword, 10);
      await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [newHash, payload.id]);

      return res.status(200).json({ success: true, message: "Password berhasil diubah" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (isAuthRateLimited(ip)) {
      return res.status(429).json({ error: "Too many attempts. Please wait." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    // POST /api/auth/register
    if (action === "register") {
      const username = sanitize(String(body.username || ""));
      const email = sanitize(String(body.email || "")).toLowerCase();
      const password = String(body.password || "");

      if (!username || username.length < 3 || username.length > 30) {
        return res.status(400).json({ error: "Username harus 3-30 karakter" });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: "Username hanya boleh huruf, angka, dan underscore" });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Email tidak valid" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password minimal 6 karakter" });
      }

      // Check existing
      const existing = await query(
        "SELECT id FROM users WHERE username = $1 OR email = $2",
        [username, email]
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: "Username atau email sudah digunakan" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const result = await query(
        "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, 'user') RETURNING id, username, email, role, created_at",
        [username, email, passwordHash]
      );

      const user = result[0];
      const token = createToken({ id: user.id, username: user.username, role: user.role });

      res.setHeader("Set-Cookie", `kv_token=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
      return res.status(201).json({ user, token });
    }

    // POST /api/auth/login
    if (action === "login") {
      const login = sanitize(String(body.username || body.email || ""));
      const password = String(body.password || "");

      if (!login || !password) {
        return res.status(400).json({ error: "Username/email dan password diperlukan" });
      }

      const rows = await query(
        "SELECT id, username, email, password_hash, role, avatar_url, created_at FROM users WHERE username = $1 OR email = $1",
        [login.toLowerCase()]
      );
      if (rows.length === 0) {
        return res.status(401).json({ error: "Username atau password salah" });
      }

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: "Username atau password salah" });
      }

      const token = createToken({ id: user.id, username: user.username, role: user.role });
      const { password_hash, ...safeUser } = user;

      res.setHeader("Set-Cookie", `kv_token=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${7 * 24 * 60 * 60}`);
      return res.status(200).json({ user: safeUser, token });
    }

    // POST /api/auth/logout
    if (action === "logout") {
      res.setHeader("Set-Cookie", "kv_token=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0");
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: "Not found" });
  } catch (error: any) {
    console.error("Auth error:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      debug_message: error?.message || String(error),
      debug_stack: error?.stack?.split("\n").slice(0, 5)
    });
  }
}
