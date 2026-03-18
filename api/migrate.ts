import type { VercelRequest, VercelResponse } from "@vercel/node";

let _query: any;

async function loadDb() {
  if (!_query) {
    const neonMod = await import("@neondatabase/serverless");
    const neon = (neonMod as any).neon || (neonMod as any).default?.neon;
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_PRISMA_URL || "";
    if (!url) throw new Error("Database not configured");
    const sql = neon(url);
    _query = (text: string, params: unknown[] = []) => sql.query(text, params);
  }
}

// Pre-computed bcrypt hash of 'admin123' (cost 10) — no need to import bcryptjs
const ADMIN_HASH = "$2b$10$VFfeR324ey/yLn/h/aK2EumR0wQJeDM6I96nclKRN2EgajssQf/DC";

const MIGRATION_SECRET = process.env.MIGRATION_SECRET || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  await loadDb();

  // Require a secret to run migrations
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  if (!MIGRATION_SECRET || body.secret !== MIGRATION_SECRET) {
    return res.status(403).json({ error: "Invalid migration secret" });
  }

  try {
    // Create tables
    await _query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await _query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comic_slug VARCHAR(255) NOT NULL,
        comic_title VARCHAR(500),
        chapter_slug VARCHAR(255),
        content TEXT NOT NULL,
        parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'approved',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await _query(`
      CREATE TABLE IF NOT EXISTS ad_placements (
        id SERIAL PRIMARY KEY,
        slot_name VARCHAR(100) UNIQUE NOT NULL,
        label VARCHAR(255) NOT NULL,
        ad_code TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT false,
        position VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await _query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT DEFAULT '',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes
    await _query("CREATE INDEX IF NOT EXISTS idx_comments_comic ON comments(comic_slug)");
    await _query("CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id)");
    await _query("CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status)");
    await _query("CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC)");

    // Seed ad placements
    const adSlots = [
      ["home-top", "Banner Atas Homepage", "home"],
      ["home-mid", "Banner Tengah Homepage", "home"],
      ["detail-sidebar", "Sidebar Detail Page", "detail"],
      ["detail-before-chapters", "Sebelum Daftar Chapter", "detail"],
      ["reader-top", "Atas Reader Page", "reader"],
      ["reader-bottom", "Bawah Reader Page", "reader"],
      ["reader-between", "Antara Panel Reader", "reader"],
    ];
    for (const [slot, label, pos] of adSlots) {
      await _query(
        "INSERT INTO ad_placements (slot_name, label, position) VALUES ($1, $2, $3) ON CONFLICT (slot_name) DO NOTHING",
        [slot, label, pos]
      );
    }

    // Seed settings
    const settings = [
      ["site_name", "KomikVerse"],
      ["site_description", "Baca manga, manhwa, manhua gratis"],
      ["ads_enabled", "false"],
      ["comment_moderation", "false"],
      ["reader_ads_interval", "10"],
    ];
    for (const [key, value] of settings) {
      await _query(
        "INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
        [key, value]
      );
    }

    // Create default admin
    await _query(
      "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, 'admin') ON CONFLICT (username) DO NOTHING",
      ["admin", "admin@komikverse.com", ADMIN_HASH]
    );

    // Add is_seed columns if not exist
    await _query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT false");
    await _query("ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT false");

    // Analytics table for tracking requests & visitors
    await _query(`
      CREATE TABLE IF NOT EXISTS api_analytics (
        id SERIAL PRIMARY KEY,
        ip_hash VARCHAR(64) NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        provider VARCHAR(50),
        user_agent TEXT,
        referer TEXT,
        country VARCHAR(10),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await _query("CREATE INDEX IF NOT EXISTS idx_analytics_created ON api_analytics(created_at DESC)");
    await _query("CREATE INDEX IF NOT EXISTS idx_analytics_endpoint ON api_analytics(endpoint)");
    await _query("CREATE INDEX IF NOT EXISTS idx_analytics_ip ON api_analytics(ip_hash)");

    return res.status(200).json({ success: true, message: "Migration completed successfully" });
  } catch (error) {
    console.error("Migration error:", error);
    return res.status(500).json({ error: "Migration failed", details: String(error) });
  }
}
