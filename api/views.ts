import type { VercelRequest, VercelResponse } from "@vercel/node";

let _query: any;

async function loadDb() {
  if (!_query) {
    const neonMod = await import("@neondatabase/serverless");
    const neon = (neonMod as any).neon || (neonMod as any).default?.neon;
    const url =
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_PRISMA_URL ||
      "";
    if (!url) throw new Error("Database not configured");
    const sql = neon(url);
    _query = (text: string, params: unknown[] = []) => sql.query(text, params);
  }
}

const BUILTIN_ALLOWED_ORIGINS = ["capacitor://localhost", "ionic://localhost"];
const LOCALHOST_ORIGIN_RE = /^https?:\/\/localhost(?::\d+)?$/i;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || "";
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Api-Token, X-Api-Timestamp");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

// Rate limit for view tracking (1 view per IP per slug per 5 minutes)
const viewRateLimit = new Map<string, number>();
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of viewRateLimit) {
    if (now > expiry) viewRateLimit.delete(key);
  }
}, 5 * 60 * 1000);

function sanitizeSlug(slug: string): string {
  return slug.replace(/[^a-zA-Z0-9\-_.]/g, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    setCors(req, res);

    if (req.method === "OPTIONS") return res.status(200).end();

    await loadDb();

    const ip = typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : "unknown";

    const path = (req.url || "").split("?")[0].replace(/^\/api\/views\/?/, "");
    const action = path.split("/")[0] || "";

    // POST /api/views/track — increment view count
    if (req.method === "POST" && action === "track") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const comic_slug = sanitizeSlug(String(body.comic_slug || ""));
      const comic_title = String(body.comic_title || "").slice(0, 500);
      const comic_image = String(body.comic_image || "").slice(0, 2000);
      const comic_type = String(body.comic_type || "").slice(0, 50);

      if (!comic_slug) return res.status(400).json({ status: "error", message: "comic_slug required" });

      // Rate limit: 1 view per IP per slug per 5 minutes
      const rlKey = `${ip}:${comic_slug}`;
      if (viewRateLimit.has(rlKey) && Date.now() < viewRateLimit.get(rlKey)!) {
        // Already counted, return current count without incrementing
        const rows = await _query("SELECT view_count FROM comic_views WHERE comic_slug = $1", [comic_slug]);
        return res.status(200).json({ status: "success", data: { view_count: rows[0]?.view_count || 0, already_counted: true } });
      }
      viewRateLimit.set(rlKey, Date.now() + 5 * 60 * 1000);

      const rows = await _query(
        `INSERT INTO comic_views (comic_slug, comic_title, comic_image, comic_type, view_count, weekly_views, updated_at)
         VALUES ($1, $2, $3, $4, 1, 1, NOW())
         ON CONFLICT (comic_slug) DO UPDATE SET
           view_count = comic_views.view_count + 1,
           weekly_views = comic_views.weekly_views + 1,
           comic_title = COALESCE(NULLIF($2, ''), comic_views.comic_title),
           comic_image = COALESCE(NULLIF($3, ''), comic_views.comic_image),
           comic_type = COALESCE(NULLIF($4, ''), comic_views.comic_type),
           updated_at = NOW()
         RETURNING view_count`,
        [comic_slug, comic_title, comic_image, comic_type]
      );

      return res.status(200).json({ status: "success", data: { view_count: rows[0].view_count } });
    }

    // POST /api/views/batch — get view counts for multiple slugs (cache 2 min)
    if (req.method === "POST" && action === "batch") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const slugs: string[] = Array.isArray(body.slugs) ? body.slugs.slice(0, 50).map((s: string) => sanitizeSlug(String(s))) : [];

      if (slugs.length === 0) return res.status(200).json({ status: "success", data: {} });

      const placeholders = slugs.map((_, i) => `$${i + 1}`).join(", ");
      const rows = await _query(
        `SELECT comic_slug, view_count, weekly_views FROM comic_views WHERE comic_slug IN (${placeholders})`,
        slugs
      );

      const result: Record<string, { view_count: number; weekly_views: number }> = {};
      for (const row of rows) {
        result[row.comic_slug] = { view_count: row.view_count, weekly_views: row.weekly_views };
      }
      return res.status(200).json({ status: "success", data: result });
    }

    // GET /api/views/leaderboard — top comics by weekly views
    if (req.method === "GET" && action === "leaderboard") {
      const type = String(req.query?.type || "all").toLowerCase();
      const limit = Math.min(Math.max(parseInt(String(req.query?.limit || "20")), 1), 50);

      let query = "SELECT comic_slug, comic_title, comic_image, comic_type, view_count, weekly_views FROM comic_views";
      const params: unknown[] = [];

      if (type !== "all" && ["manga", "manhwa", "manhua"].includes(type)) {
        query += " WHERE LOWER(comic_type) = $1";
        params.push(type);
        query += " ORDER BY weekly_views DESC, view_count DESC LIMIT $2";
        params.push(limit);
      } else {
        query += " ORDER BY weekly_views DESC, view_count DESC LIMIT $1";
        params.push(limit);
      }

      const rows = await _query(query, params);
      const data = rows.map((row: any, i: number) => ({
        rank: i + 1,
        comic_slug: row.comic_slug,
        comic_title: row.comic_title,
        comic_image: row.comic_image,
        comic_type: row.comic_type,
        view_count: row.view_count,
        weekly_views: row.weekly_views,
      }));

      // Cache leaderboard for 5 min at edge
      res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");

      return res.status(200).json({ status: "success", data });
    }

    // GET /api/views/:slug — get view count for a single comic
    if (req.method === "GET" && action) {
      const slug = sanitizeSlug(action);
      const rows = await _query("SELECT view_count, weekly_views FROM comic_views WHERE comic_slug = $1", [slug]);
      // Cache individual view count for 3 min at edge
      res.setHeader("Cache-Control", "public, s-maxage=180, stale-while-revalidate=300");
      if (rows.length === 0) return res.status(200).json({ status: "success", data: { view_count: 0, weekly_views: 0 } });
      return res.status(200).json({ status: "success", data: rows[0] });
    }

    return res.status(404).json({ status: "error", message: "Not found" });
  } catch (error: any) {
    console.error("Views error:", error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
}
