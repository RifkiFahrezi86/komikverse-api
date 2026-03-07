import type { VercelRequest, VercelResponse } from "@vercel/node";

let _query: any;
let _jwt: any;
let _bcrypt: any;

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
  if (!_bcrypt) {
    const b = await import("bcryptjs");
    _bcrypt = (b as any).default || b;
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

function getAdmin(req: VercelRequest): any {
  const authHeader = req.headers.authorization;
  let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    const cookies = req.headers.cookie || "";
    const match = cookies.match(/kv_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  try {
    const payload = _jwt.verify(token, JWT_SECRET) as any;
    return payload.role === "admin" ? payload : null;
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
  await loadAll();

  const admin = getAdmin(req);
  if (!admin) return res.status(403).json({ error: "Admin access required" });

  const path = (req.url || "").split("?")[0].replace(/^\/api\/admin\/?/, "");
  const resource = path.split("/")[0] || "";

    // ─── Stats ───
    if (resource === "stats" && req.method === "GET") {
      const [users, comments, pendingComments, activeAds] = await Promise.all([
        _query("SELECT COUNT(*) as count FROM users"),
        _query("SELECT COUNT(*) as count FROM comments"),
        _query("SELECT COUNT(*) as count FROM comments WHERE status = 'pending'"),
        _query("SELECT COUNT(*) as count FROM ad_placements WHERE is_active = true"),
      ]);

      const recentComments = await _query(
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
        const rows = await _query(
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
        await _query("UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2", [role, id]);
        return res.status(200).json({ success: true });
      }
      if (req.method === "DELETE") {
        const id = parseInt(String(req.query.id));
        if (!id) return res.status(400).json({ error: "User id required" });
        if (id === admin.id) return res.status(400).json({ error: "Cannot delete yourself" });
        await _query("DELETE FROM users WHERE id = $1", [id]);
        return res.status(200).json({ success: true });
      }
      // PUT /api/admin/users/reset-password — Admin resets a user's password
      if (req.method === "PUT") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const id = parseInt(body.id);
        const newPassword = String(body.new_password || "");
        if (!id) return res.status(400).json({ error: "User id required" });
        if (newPassword.length < 6) return res.status(400).json({ error: "Password minimal 6 karakter" });
        const newHash = await _bcrypt.hash(newPassword, 10);
        await _query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [newHash, id]);
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
        const rows = await _query(sql, params);
        return res.status(200).json({ comments: rows });
      }
      if (req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const id = parseInt(body.id);
        const status = String(body.status || "");
        if (!id || !["approved", "pending", "hidden"].includes(status)) {
          return res.status(400).json({ error: "Invalid" });
        }
        await _query("UPDATE comments SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
        return res.status(200).json({ success: true });
      }
      if (req.method === "DELETE") {
        const id = parseInt(String(req.query.id));
        if (!id) return res.status(400).json({ error: "Comment id required" });
        await _query("DELETE FROM comments WHERE id = $1", [id]);
        return res.status(200).json({ success: true });
      }
    }

    // ─── Ad Placements ───
    if (resource === "ads") {
      if (req.method === "GET") {
        const rows = await _query("SELECT * FROM ad_placements ORDER BY id");
        return res.status(200).json({ ads: rows });
      }
      if (req.method === "PUT") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const id = parseInt(body.id);
        if (!id) return res.status(400).json({ error: "Ad id required" });

        const adCode = String(body.ad_code ?? "");
        const isActive = Boolean(body.is_active);

        await _query(
          "UPDATE ad_placements SET ad_code = $1, is_active = $2, updated_at = NOW() WHERE id = $3",
          [adCode, isActive, id]
        );
        return res.status(200).json({ success: true });
      }
    }

    // ─── Seed Data ───
    if (resource === "seed" && req.method === "POST") {
      const FIRST_NAMES = [
        "Andi","Budi","Citra","Dewi","Eko","Fitri","Gilang","Hana","Irfan","Joni",
        "Kiki","Lina","Maya","Nanda","Oscar","Putra","Rina","Sari","Toni","Umi",
        "Vina","Wawan","Yudi","Zahra","Adi","Bayu","Dimas","Fajar","Galih","Hendra",
        "Indra","Joko","Kartika","Lukman","Mira","Nisa","Putri","Ratna","Sinta","Tika",
        "Agus","Bambang","Chandra","Dian","Eka","Feri","Gunawan","Heri","Ivan","Jihan"
      ];
      const LAST_NAMES = [
        "Pratama","Saputra","Wijaya","Kusuma","Hidayat","Nugraha","Permana","Sanjaya",
        "Putra","Setiawan","Utama","Lestari","Wicaksono","Budiman","Hartono","Prabowo",
        "Santoso","Suryadi","Firmansyah","Ramadhan"
      ];
      const COMMENTS_POOL = [
        "Mantap banget chapter ini! 🔥","Gak sabar nunggu lanjutannya","Artwork-nya makin keren aja",
        "Ceritanya makin seru! Plot twist nya gila","Karakter utamanya makin badass 💪","Update terus min!",
        "Ini manhwa/manga terbaik sih","Baru baca langsung ketagihan","Nunggu update tiap hari",
        "MC nya OP banget wkwk","Alur ceritanya unpredictable","Suka banget sama art style nya",
        "Chapter ini bikin penasaran","Semoga ada season 2","Rating 10/10 dari gue 👍",
        "Baru mulai baca, langsung marathon","Ceritanya deep banget","Recommended buat yg suka genre ini",
        "Auto favorit deh ini mah","Kapan update lagi min?","Ngakak baca chapter ini 😂",
        "Sedih banget pas scene itu 😢","Worth read pokoknya","Top tier manhwa/manga sih ini",
        "Salah satu yg terbaik yg pernah gue baca","Penasaran sama ending nya",
        "Gak nyesel baca dari awal","Artwork level dewa 🎨","Semakin klimaks aja ceritanya",
        "Ini hidden gem banget","Underrated parah sih ini","Wajib baca!",
        "Lanjut terus min jangan discontinue","Plot nya well-written banget","Best character development",
        "Makin ke sini makin seru","Guilty pleasure gue nih 😅","Binge read 50 chapter sekaligus",
        "The art is insane!","Love the story progression","Keren abis!!! 🤩",
      ];
      const COMIC_DATA = [
        { slug: "solo-leveling", title: "Solo Leveling" },
        { slug: "one-piece", title: "One Piece" },
        { slug: "tower-of-god", title: "Tower of God" },
        { slug: "the-beginning-after-the-end", title: "The Beginning After The End" },
        { slug: "omniscient-reader", title: "Omniscient Reader's Viewpoint" },
        { slug: "martial-peak", title: "Martial Peak" },
        { slug: "return-of-the-mount-hua-sect", title: "Return of the Mount Hua Sect" },
        { slug: "nano-machine", title: "Nano Machine" },
        { slug: "eleceed", title: "Eleceed" },
        { slug: "windbreaker", title: "Windbreaker" },
        { slug: "legend-of-the-northern-blade", title: "Legend of the Northern Blade" },
        { slug: "the-great-mage-returns", title: "The Great Mage Returns After 4000 Years" },
        { slug: "overgeared", title: "Overgeared" },
        { slug: "doom-breaker", title: "Doom Breaker" },
        { slug: "teenage-mercenary", title: "Teenage Mercenary" },
      ];

      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const userCount = Math.min(Math.max(parseInt(body.userCount) || 20, 5), 50);
      const commentCount = Math.min(Math.max(parseInt(body.commentCount) || 60, 10), 200);

      const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

      // Create fake users
      const createdUserIds: number[] = [];
      const fakeHash = await _bcrypt.hash("fakeuser123", 10);
      for (let i = 0; i < userCount; i++) {
        const fn = pick(FIRST_NAMES);
        const ln = pick(LAST_NAMES);
        const suffix = Math.floor(Math.random() * 999);
        const username = `${fn.toLowerCase()}${ln.toLowerCase()}${suffix}`;
        const email = `${username}@gmail.com`;
        const daysAgo = Math.floor(Math.random() * 180) + 30;
        const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
        try {
          const rows = await _query(
            `INSERT INTO users (username, email, password_hash, role, created_at) 
             VALUES ($1, $2, $3, 'user', $4) 
             ON CONFLICT (username) DO NOTHING 
             RETURNING id`,
            [username, email, fakeHash, createdAt]
          );
          if (rows.length > 0) createdUserIds.push(rows[0].id);
        } catch { /* skip duplicates */ }
      }

      // Also get existing non-admin users
      const existingUsers = await _query("SELECT id FROM users WHERE role = 'user' LIMIT 50");
      const allUserIds = [...new Set([...createdUserIds, ...existingUsers.map((u: any) => u.id)])];
      if (allUserIds.length === 0) {
        return res.status(400).json({ error: "No users available for seeding comments" });
      }

      // Create fake comments spread over time
      let insertedComments = 0;
      for (let i = 0; i < commentCount; i++) {
        const userId = pick(allUserIds);
        const comic = pick(COMIC_DATA);
        const content = pick(COMMENTS_POOL);
        const daysAgo = Math.floor(Math.random() * 150);
        const hoursAgo = Math.floor(Math.random() * 24);
        const createdAt = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000).toISOString();
        const status = Math.random() < 0.85 ? "approved" : "pending";
        try {
          await _query(
            `INSERT INTO comments (user_id, comic_slug, comic_title, content, status, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, comic.slug, comic.title, content, status, createdAt]
          );
          insertedComments++;
        } catch { /* skip errors */ }
      }

      return res.status(200).json({
        success: true,
        users_created: createdUserIds.length,
        comments_created: insertedComments,
      });
    }

    // ─── Settings ───
    if (resource === "settings") {
      if (req.method === "GET") {
        const rows = await _query("SELECT key, value FROM site_settings");
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
          await _query(
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
