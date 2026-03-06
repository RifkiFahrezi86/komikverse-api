import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query } from "./lib/db";
import bcrypt from "bcryptjs";

const MIGRATION_SECRET = process.env.MIGRATION_SECRET || process.env.JWT_SECRET || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // Require a secret to run migrations
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  if (!MIGRATION_SECRET || body.secret !== MIGRATION_SECRET) {
    return res.status(403).json({ error: "Invalid migration secret" });
  }

  try {
    // Create tables
    await query(`
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

    await query(`
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

    await query(`
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

    await query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT DEFAULT '',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes
    await query("CREATE INDEX IF NOT EXISTS idx_comments_comic ON comments(comic_slug)");
    await query("CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id)");
    await query("CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status)");
    await query("CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC)");

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
      await query(
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
      await query(
        "INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
        [key, value]
      );
    }

    // Create default admin
    const adminHash = await bcrypt.hash("admin123", 10);
    await query(
      "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, 'admin') ON CONFLICT (username) DO NOTHING",
      ["admin", "admin@komikverse.com", adminHash]
    );

    return res.status(200).json({ success: true, message: "Migration completed successfully" });
  } catch (error) {
    console.error("Migration error:", error);
    return res.status(500).json({ error: "Migration failed", details: String(error) });
  }
}
