-- KomikVerse Database Schema
-- Run this in Vercel/Neon Postgres console

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comic_slug VARCHAR(255) NOT NULL,
  comic_title VARCHAR(500),
  chapter_slug VARCHAR(255),
  content TEXT NOT NULL,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'hidden')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ad placements table
CREATE TABLE IF NOT EXISTS ad_placements (
  id SERIAL PRIMARY KEY,
  slot_name VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(255) NOT NULL,
  ad_code TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT false,
  position VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Site settings table
CREATE TABLE IF NOT EXISTS site_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_comic ON comments(comic_slug);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);

-- Seed default ad placements
INSERT INTO ad_placements (slot_name, label, position, is_active) VALUES
  ('home-bottom-1', 'Banner Bawah Homepage 1', 'home', false),
  ('home-bottom-2', 'Banner Bawah Homepage 2', 'home', false),
  ('home-bottom-3', 'Banner Bawah Homepage 3', 'home', false),
  ('home-bottom-4', 'Banner Bawah Homepage 4', 'home', false),
  ('detail-sidebar', 'Sidebar Detail Page', 'detail', false),
  ('detail-before-chapters', 'Sebelum Daftar Chapter', 'detail', false),
  ('reader-top', 'Atas Reader Page', 'reader', false),
  ('reader-bottom', 'Bawah Reader Page', 'reader', false),
  ('reader-between', 'Antara Panel Reader', 'reader', false),
  ('popup-global', 'Popup/Interstitial (Seluruh Halaman)', 'global', false),
  ('native-detail', 'Native Banner Detail Page', 'detail', false)
ON CONFLICT (slot_name) DO NOTHING;

-- Seed default site settings
INSERT INTO site_settings (key, value) VALUES
  ('site_name', 'KomikVerse'),
  ('site_description', 'Baca manga, manhwa, manhua gratis'),
  ('ads_enabled', 'false'),
  ('comment_moderation', 'false'),
  ('reader_ads_interval', '10')
ON CONFLICT (key) DO NOTHING;

-- Create default admin (password: admin123 - CHANGE THIS!)
-- bcrypt hash of 'admin123' with cost 10
INSERT INTO users (username, email, password_hash, role) VALUES
  ('admin', 'admin@komikverse.com', '$2b$10$VFfeR324ey/yLn/h/aK2EumR0wQJeDM6I96nclKRN2EgajssQf/DC', 'admin')
ON CONFLICT (username) DO NOTHING;

-- ═══════════════════════════════════════
-- Phase 37: View tracking & Streak leaderboard
-- ═══════════════════════════════════════

-- Comic view tracking table
CREATE TABLE IF NOT EXISTS comic_views (
  id SERIAL PRIMARY KEY,
  comic_slug VARCHAR(255) NOT NULL UNIQUE,
  comic_title VARCHAR(500),
  comic_image TEXT,
  comic_type VARCHAR(50),
  view_count INTEGER DEFAULT 0,
  weekly_views INTEGER DEFAULT 0,
  last_weekly_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comic_views_weekly ON comic_views(weekly_views DESC);
CREATE INDEX IF NOT EXISTS idx_comic_views_total ON comic_views(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_comic_views_type ON comic_views(comic_type);

-- User streak tracking columns for leaderboard
ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_free BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_read_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_free_until TIMESTAMP WITH TIME ZONE;
