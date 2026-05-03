import type { VercelRequest, VercelResponse } from "@vercel/node";

let _query: any;
let _jwt: any;

async function loadAll() {
  if (!_query) {
    const neonMod = await import("@neondatabase/serverless");
    const neon = (neonMod as any).neon || (neonMod as any).default?.neon;
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_PRISMA_URL || "";
    if (!url) throw new Error("Database not configured");
    const sql = neon(url);
    _query = (text: string, params: unknown[] = []) => sql.query(text, params);
  }
  if (!_jwt) {
    const j = await import("jsonwebtoken");
    _jwt = (j as any).default || j;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "komikverse-secret-key-change-me";
const BUILTIN_ALLOWED_ORIGINS = [
  "capacitor://localhost",
  "ionic://localhost",
  "https://komikverse-swart.vercel.app",
  "https://komikverse.vercel.app",
];
const LOCALHOST_ORIGIN_RE = /^https?:\/\/localhost(?::\d+)?$/i;
function normalizeOriginValue(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(normalizeOriginValue)
  .filter(Boolean);

interface JwtPayload {
  id: number;
  username: string;
  role: string;
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = normalizeOriginValue(String(req.headers.origin || ""));
  const allowedOrigin = !origin
    ? (ALLOWED_ORIGINS.length === 0 ? "*" : "")
    : (
      ALLOWED_ORIGINS.length === 0
      || ALLOWED_ORIGINS.includes(origin)
      || BUILTIN_ALLOWED_ORIGINS.includes(origin)
      || LOCALHOST_ORIGIN_RE.test(origin)
    )
      ? origin
      : "";
  if (allowedOrigin) res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

function getUser(req: VercelRequest): JwtPayload | null {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    const cookies = req.headers.cookie || "";
    const match = cookies.match(/kv_token=([^;]+)/);
    if (!match) return null;
    try { return _jwt.verify(match[1], JWT_SECRET) as JwtPayload; } catch { return null; }
  }
  try { return _jwt.verify(token, JWT_SECRET) as JwtPayload; } catch { return null; }
}

async function getUserWithFreshRole(req: VercelRequest): Promise<JwtPayload | null> {
  const payload = getUser(req);
  if (!payload) return null;
  const rows = await _query("SELECT id, username, role FROM users WHERE id = $1", [payload.id]);
  if (rows.length === 0) return null;
  return { ...payload, role: rows[0].role };
}

function sanitizeComment(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim().slice(0, 2000);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  await loadAll();

  try {
    // GET /api/comments?comic_slug=xxx
    if (req.method === "GET") {
      const comicSlug = String(req.query.comic_slug || "");
      if (!comicSlug) return res.status(400).json({ error: "comic_slug required" });

      const rows = await _query(
        `SELECT c.id, c.content, c.comic_slug, c.chapter_slug, c.parent_id, c.created_at,
                u.id as user_id, u.username, u.avatar_url, u.role as user_role
         FROM comments c
         JOIN users u ON c.user_id = u.id
         WHERE c.comic_slug = $1 AND c.status = 'approved'
         ORDER BY c.created_at DESC`,
        [comicSlug]
      );

      // Build threaded structure
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const commentMap = new Map<number, any>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topLevel: any[] = [];

      for (const row of rows) {
        const comment = {
          id: row.id,
          content: row.content,
          comic_slug: row.comic_slug,
          chapter_slug: row.chapter_slug,
          parent_id: row.parent_id,
          created_at: row.created_at,
          user: { id: row.user_id, username: row.username, avatar_url: row.avatar_url, role: row.user_role },
          replies: [],
        };
        commentMap.set(comment.id, comment);
      }

      for (const comment of commentMap.values()) {
        if (comment.parent_id && commentMap.has(comment.parent_id)) {
          commentMap.get(comment.parent_id).replies.push(comment);
        } else {
          topLevel.push(comment);
        }
      }

      return res.status(200).json({ comments: topLevel, total: rows.length });
    }

    // POST /api/comments
    if (req.method === "POST") {
      const user = getUser(req);
      if (!user) return res.status(401).json({ error: "Login diperlukan untuk berkomentar" });

      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const content = sanitizeComment(String(body.content || ""));
      const comicSlug = String(body.comic_slug || "").trim();
      const comicTitle = String(body.comic_title || "").trim().slice(0, 500);
      const chapterSlug = body.chapter_slug ? String(body.chapter_slug).trim() : null;
      const parentId = body.parent_id ? parseInt(body.parent_id) : null;

      if (!content || content.length < 1) {
        return res.status(400).json({ error: "Komentar tidak boleh kosong" });
      }
      if (!comicSlug) {
        return res.status(400).json({ error: "comic_slug required" });
      }

      // Check if comment moderation is enabled
      const settings = await _query("SELECT value FROM site_settings WHERE key = 'comment_moderation'");
      const moderation = settings.length > 0 && settings[0].value === "true";
      const status = moderation ? "pending" : "approved";

      const result = await _query(
        `INSERT INTO comments (user_id, comic_slug, comic_title, chapter_slug, content, parent_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, content, comic_slug, chapter_slug, parent_id, status, created_at`,
        [user.id, comicSlug, comicTitle, chapterSlug, content, parentId, status]
      );

      return res.status(201).json({
        comment: {
          ...result[0],
          user: { id: user.id, username: user.username },
        },
      });
    }

    // DELETE /api/comments?id=xxx
    if (req.method === "DELETE") {
      const user = await getUserWithFreshRole(req);
      if (!user) return res.status(401).json({ error: "Not authenticated" });

      const id = parseInt(String(req.query.id));
      if (!id) return res.status(400).json({ error: "Comment id required" });

      // Users can delete own comments, admins/owners can delete any
      if (user.role === "admin" || user.role === "owner") {
        await _query("DELETE FROM comments WHERE id = $1", [id]);
      } else {
        const result = await _query("DELETE FROM comments WHERE id = $1 AND user_id = $2", [id, user.id]);
        if (result.length === 0) {
          // Check if it existed
          const exists = await _query("SELECT id FROM comments WHERE id = $1", [id]);
          if (exists.length > 0) return res.status(403).json({ error: "Tidak diizinkan" });
        }
      }

      return res.status(200).json({ success: true });
    }

    // PATCH /api/comments - admin only, update status
    if (req.method === "PATCH") {
      const user = await getUserWithFreshRole(req);
      if (!user || (user.role !== "admin" && user.role !== "owner")) return res.status(403).json({ error: "Admin only" });

      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const id = parseInt(body.id);
      const status = String(body.status || "");

      if (!id || !["approved", "pending", "hidden"].includes(status)) {
        return res.status(400).json({ error: "Invalid id or status" });
      }

      await _query("UPDATE comments SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Comments error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
