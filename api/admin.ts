import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./lib/db";

let jwt: any;
let bcrypt: any;

async function loadDeps() {
  if (!jwt) {
    const j = await import("jsonwebtoken");
    jwt = (j as any).default || j;
  }
  if (!bcrypt) {
    const b = await import("bcryptjs");
    bcrypt = (b as any).default || b;
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function getAdmin(req: VercelRequest): JwtPayload | null {
  const authHeader = req.headers.authorization;
  let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    const cookies = req.headers.cookie || "";
    const match = cookies.match(/kv_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return payload.role === "admin" ? payload : null;
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  await loadDeps();

  const admin = getAdmin(req);
  if (!admin) return res.status(403).json({ error: "Admin access required" });

  const path = (req.url || "").split("?")[0].replace(/^\/api\/admin\/?/, "");
  const resource = path.split("/")[0] || "";

  try {
    // ─── Stats ───
    if (resource === "stats" && req.method === "GET") {
      const [users, comments, pendingComments, activeAds] = await Promise.all([
        query("SELECT COUNT(*) as count FROM users"),
        query("SELECT COUNT(*) as count FROM comments"),
        query("SELECT COUNT(*) as count FROM comments WHERE status = 'pending'"),
        query("SELECT COUNT(*) as count FROM ad_placements WHERE is_active = true"),
      ]);

      const recentComments = await query(
        `SELECT c.id, c.content, c.comic_slug, c.comic_title, c.status, c.created_at,
                u.username
         FROM comments c JOIN users u ON c.user_id = u.id
         ORDER BY c.created_at DESC LIMIT 10`
      );

      return res.status(200).json({
        stats: {
          total_users: parseInt(users[0].count),
          total_comments: parseInt(comments[0].count),
          pending_comments: parseInt(pendingComments[0].count),
          active_ads: parseInt(activeAds[0].count),
        },
        recent_comments: recentComments,
      });
    }

    // ─── Users ───
    if (resource === "users") {
      if (req.method === "GET") {
        const rows = await query(
          "SELECT id, username, email, role, avatar_url, created_at FROM users ORDER BY created_at DESC"
        );
        return res.status(200).json({ users: rows });
      }
      if (req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const id = parseInt(body.id);
        const role = String(body.role || "");
        if (!id || !["user", "admin"].includes(role)) {
          return res.status(400).json({ error: "Invalid id or role" });
        }
        // Prevent self-demotion
        if (id === admin.id && role !== "admin") {
          return res.status(400).json({ error: "Cannot change your own role" });
        }
        await query("UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2", [role, id]);
        return res.status(200).json({ success: true });
      }
      if (req.method === "DELETE") {
        const id = parseInt(String(req.query.id));
        if (!id) return res.status(400).json({ error: "User id required" });
        if (id === admin.id) return res.status(400).json({ error: "Cannot delete yourself" });
        await query("DELETE FROM users WHERE id = $1", [id]);
        return res.status(200).json({ success: true });
      }
      // PUT /api/admin/users/reset-password — Admin resets a user's password
      if (req.method === "PUT") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const id = parseInt(body.id);
        const newPassword = String(body.new_password || "");
        if (!id) return res.status(400).json({ error: "User id required" });
        if (newPassword.length < 6) return res.status(400).json({ error: "Password minimal 6 karakter" });
        const newHash = await bcrypt.hash(newPassword, 10);
        await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [newHash, id]);
        return res.status(200).json({ success: true, message: "Password berhasil direset" });
      }
    }

    // ─── Comments (admin view) ───
    if (resource === "comments") {
      if (req.method === "GET") {
        const status = req.query.status ? String(req.query.status) : null;
        let sql = `SELECT c.id, c.content, c.comic_slug, c.comic_title, c.chapter_slug,
                           c.parent_id, c.status, c.created_at,
                           u.id as user_id, u.username, u.avatar_url
                    FROM comments c JOIN users u ON c.user_id = u.id`;
        const params: unknown[] = [];
        if (status && ["approved", "pending", "hidden"].includes(status)) {
          sql += " WHERE c.status = $1";
          params.push(status);
        }
        sql += " ORDER BY c.created_at DESC LIMIT 200";
        const rows = await query(sql, params);
        return res.status(200).json({ comments: rows });
      }
      if (req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const id = parseInt(body.id);
        const status = String(body.status || "");
        if (!id || !["approved", "pending", "hidden"].includes(status)) {
          return res.status(400).json({ error: "Invalid" });
        }
        await query("UPDATE comments SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
        return res.status(200).json({ success: true });
      }
      if (req.method === "DELETE") {
        const id = parseInt(String(req.query.id));
        if (!id) return res.status(400).json({ error: "Comment id required" });
        await query("DELETE FROM comments WHERE id = $1", [id]);
        return res.status(200).json({ success: true });
      }
    }

    // ─── Ad Placements ───
    if (resource === "ads") {
      if (req.method === "GET") {
        const rows = await query("SELECT * FROM ad_placements ORDER BY id");
        return res.status(200).json({ ads: rows });
      }
      if (req.method === "PUT") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const id = parseInt(body.id);
        if (!id) return res.status(400).json({ error: "Ad id required" });

        const adCode = String(body.ad_code ?? "");
        const isActive = Boolean(body.is_active);

        await query(
          "UPDATE ad_placements SET ad_code = $1, is_active = $2, updated_at = NOW() WHERE id = $3",
          [adCode, isActive, id]
        );
        return res.status(200).json({ success: true });
      }
    }

    // ─── Settings ───
    if (resource === "settings") {
      if (req.method === "GET") {
        const rows = await query("SELECT key, value FROM site_settings");
        const settings: Record<string, string> = {};
        for (const row of rows) settings[row.key] = row.value;
        return res.status(200).json({ settings });
      }
      if (req.method === "PUT") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const entries = Object.entries(body) as [string, string][];
        for (const [key, value] of entries) {
          const safeKey = key.replace(/[^a-z0-9_]/gi, "").slice(0, 100);
          const safeValue = String(value).slice(0, 5000);
          await query(
            "INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()",
            [safeKey, safeValue]
          );
        }
        return res.status(200).json({ success: true });
      }
    }

    return res.status(404).json({ error: "Not found" });
  } catch (error) {
    console.error("Admin error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
