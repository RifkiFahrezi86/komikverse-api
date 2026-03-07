import type { VercelRequest, VercelResponse } from "@vercel/node";

let _query: any;
let _jwt: any;
let _bcrypt: any;
let _seedColsMigrated = false;

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
  // Auto-ensure is_seed columns exist (runs once per cold start)
  if (!_seedColsMigrated) {
    try {
      await _query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT false");
      await _query("ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT false");
    } catch { /* ignore if already exists or table missing */ }
    _seedColsMigrated = true;
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

// ─── Fake data pools ───
const FAKE_NAMES = [
  "Andi Pratama", "Siti Nurhaliza", "Budi Santoso", "Rina Wati", "Dimas Putra",
  "Maya Sari", "Rizky Aditya", "Dewi Lestari", "Fajar Hidayat", "Putri Amelia",
  "Agus Setiawan", "Nina Kartika", "Hendra Gunawan", "Lina Marlina", "Tono Wijaya",
  "Fitri Handayani", "Arman Maulana", "Yuni Astuti", "Bayu Nugroho", "Citra Dewi",
  "Deni Firmansyah", "Eka Rahmawati", "Galih Prakoso", "Hani Safitri", "Irwan Syahputra",
  "Joko Susilo", "Karina Putri", "Lukman Hakim", "Mega Puspita", "Nanda Permana",
  "Oscar Tirta", "Puspita Sari", "Qori Ananda", "Rahmat Dani", "Selvi Oktaviani",
  "Taufik Hidayat", "Umar Bakri", "Vina Melati", "Wahyu Ramadhan", "Xena Gabriella",
  "Yoga Pranata", "Zahra Aisyah", "Adit Kurniawan", "Bella Safira", "Cahya Utama",
  "Dina Fitriani", "Eko Prasetyo", "Fani Anggraeni", "Gilang Ramadhan", "Hasna Nabila",
  "Intan Permatasari", "Joni Iskandar", "Kartini Susanti", "Laras Setyowati", "Mulyadi Putra",
  "Nisa Aulia", "Okta Rivaldi", "Prita Maharani", "Rendi Saputra", "Siska Amalia",
  "Teguh Wicaksono", "Ulfah Khoirunnisa", "Vino Bastian", "Winda Kusuma", "Yanto Sumarno",
  "Zaki Mubarak", "Anisa Rahma", "Bagus Hernawan", "Cindy Claudia", "Dwi Hartono",
  "Elsa Permata", "Farhan Ramadhan", "Gita Novalita", "Hafiz Pratama", "Imas Suryani",
  "Jihan Aulia", "Kevin Sanjaya", "Lia Andriani", "Malik Ibrahim", "Nadia Putri",
  "Opik Tauhid", "Pipit Anggraini", "Rangga Wibowo", "Sari Indah", "Tika Ramadhani",
  "Ulfa Hidayah", "Viktor Manurung", "Widya Kusumawati", "Yudha Ardiansyah", "Zulfa Maharani",
  "Aris Munandar", "Bunga Citra", "Chandra Wijaya", "Diana Purnama", "Erwin Saputra",
  "Fira Adelina", "Guntur Setiabudi", "Hesti Purwanti", "Ivan Setiawan", "Jasmine Zahra",
];

const FAKE_COMMENTS = [
  "Mantap banget ceritanya, lanjut terus!", "Artwork-nya keren parah! Detail banget gambarnya",
  "Nunggu chapter selanjutnya nih, seru abis", "MC-nya overpower banget dah wkwk",
  "Ini manhwa terbaik yang pernah gue baca sih", "Plotnya makin tebal aja nih, penasaran kelanjutannya",
  "Kapan ya update chapter baru? Udah gak sabar", "Baru mulai baca tapi langsung ketagihan",
  "Sumpah ini ceritanya bikin nagih, gak bisa berhenti baca", "Character developmentnya bagus banget",
  "Art style-nya unik dan enak diliat", "Penjahatnya serem banget di chapter ini",
  "Akhirnya MC punya power-up baru! Keren!", "Scene battle-nya epic banget chapter ini",
  "Wah plot twist-nya gak kepikiran sama sekali", "Nangis gue baca chapter ini, sedih banget",
  "Mantap! Translator-nya juga bagus, enak dibaca", "World building-nya detail banget sih",
  "Ini komik underrated banget, harusnya lebih terkenal", "10/10 recommended buat yang suka genre ini",
  "Suka banget sama chemistry antar karakternya", "Setiap chapter selalu bikin penasaran",
  "Udah baca dari chapter 1, makin ke sini makin seru", "Panel action-nya fluid banget, kayak nonton anime",
  "Side character-nya juga menarik, gak cuma MC doang", "Pacing ceritanya pas, gak terlalu cepet atau lambat",
  "Author-nya emang jenius sih bikin cerita kayak gini", "Rekomendasi dari temen, ternyata emang bagus",
  "Baru marathon baca semalaman, worth it!", "Komik ini yang bikin gue suka baca manhwa",
  "Gak nyangka bakal seseru ini, awalnya ragu mau baca", "Favorit gue tahun ini sih komik ini",
  "Humor-nya receh tapi ngakak wkwk", "Adegan romantisnya sweet banget",
  "Power system-nya unik dan menarik", "Ini mirip Solo Leveling tapi versi lebih bagus",
  "Setiap karakter punya backstory yang menarik", "Cliffhanger lagi... author jahat banget",
  "Gue sampe bikin fan art buat komik ini", "Panelnya artistik banget, kayak lukisan",
  "Villain-nya kali ini beda dari yang lain, lebih complex", "Friendship goal banget karakter-karakternya",
  "Chapter ini pendek banget, kurang puas bacanya", "Akhirnya arc ini selesai juga, epic ending!",
  "Gue udah prediksi dari awal kalau dia itu bos terakhir", "OST anime-nya pasti keren kalau diadaptasi",
  "Ranking 1 di list baca gue", "Alur ceritanya unpredictable banget, suka!",
  "Training arc-nya bikin gregetan tapi worth it", "Wah ternyata dia masih hidup, plot armor kuat",
  "Gue baca ulang dari awal buat ngerti semua foreshadowing-nya", "Bikin teori: pasti nanti dia bakal jadi ally",
  "Setiap chapter makin intense, author gak kasih napas", "Komik comfort gue kalau lagi stress",
  "Gambarnya HD banget, enak baca di layar gede", "Suka sama design armor/costume karakternya",
  "Emotional damage chapter ini, hati gue remuk", "Gak sabar nunggu season 2!",
  "Ini genre apa sih? Kok bisa mix adventure sama romance gini bagusnya", "Dari semua komik yang gue baca, ini top 3",
  "Chapter 1 udah langsung hook, jarang ada komik kayak gini", "Pengen beli merchandise-nya kalau ada",
  "Komunitas fans-nya juga asyik, banyak diskusi seru", "Semoga gak hiatus ya author",
  "Level up system-nya bikin ketagihan, kayak main game", "Twist di akhir chapter bikin gue teriak sendiri",
  "Kalau ini diadaptasi jadi anime, pasti trending", "Ini guilty pleasure gue sih ngl",
  "Ngikutin dari awal rilis, gak pernah skip satu chapter pun", "Raw-nya udah keluar belum ya?",
  "Gue sampe bikin spreadsheet buat tracking power level karakternya", "Best waifu/husbando material",
  "Isekai terbaik yang pernah ada, change my mind", "Gue rekomendasiin ke semua temen gue",
  "Author konsisten banget update-nya, salut!", "Paneling-nya kreatif, beda dari komik lain",
  "Ini chapter filler tapi tetep entertaining", "Lore-nya deep banget, perlu wiki sendiri",
  "Comeback arc terbaik sepanjang masa!", "Gue nangis terharu di bagian reunion",
  "Dark fantasy yang bener-bener dark, suka!", "Comedy-nya natural, gak maksa",
  "Satu-satunya komik yang bikin gue baca genre ini", "Kapan ya ada light novel-nya?",
  "Chapter gratisan tapi kualitasnya premium", "Makin lama makin bagus art-nya",
  "Sacrifice-nya MC bikin gue speechless", "Ini harem done right, rare banget",
  "Solo arc MC emang selalu the best", "Gue bookmark semua chapter favorit gue",
  "Pengen cosplay jadi karakter ini", "Setiap re-read selalu nemu detail baru",
  "Ini komik pertama yang bikin gue nangis", "Genre thriller psikologis kayak gini kurang di pasaran",
  "Support author-nya dengan baca di platform resmi ya!", "Legendary status komik ini",
  "Gue harap ending-nya memuaskan", "Mind-blowing revelation di chapter ini!",
  "Udah tamat tapi masih sering baca ulang", "Peak fiction, no debate",
  "Baru baca 5 chapter tapi udah jatuh cinta sama ceritanya", "Tiap hari cek update, ini komik wajib baca",
  "Kerenn banget fight scene chapter ini!!", "Sumpah antagonisnya well-written banget",
];

const COMIC_SLUGS = [
  "solo-leveling", "one-piece", "tower-of-god", "the-beginning-after-the-end",
  "omniscient-reader", "return-of-the-blossoming-blade", "nano-machine",
  "legend-of-the-northern-blade", "teenage-mercenary", "doom-breaker",
  "reaper-of-the-drifting-moon", "return-to-player", "mercenary-enrollment",
  "eleceed", "windbreaker", "study-group", "weak-hero", "lookism",
  "god-of-blackfield", "max-level-hero-returned", "overgeared",
  "the-great-mage-returns-after-4000-years", "martial-peak", "apotheosis",
  "tales-of-demons-and-gods", "star-martial-god-technique", "magic-emperor",
  "volcanic-age", "chronicles-of-heavenly-demon", "medical-return",
];

const COMIC_TITLES: Record<string, string> = {
  "solo-leveling": "Solo Leveling", "one-piece": "One Piece",
  "tower-of-god": "Tower of God", "the-beginning-after-the-end": "The Beginning After The End",
  "omniscient-reader": "Omniscient Reader's Viewpoint", "return-of-the-blossoming-blade": "Return of the Blossoming Blade",
  "nano-machine": "Nano Machine", "legend-of-the-northern-blade": "Legend of the Northern Blade",
  "teenage-mercenary": "Teenage Mercenary", "doom-breaker": "Doom Breaker",
  "reaper-of-the-drifting-moon": "Reaper of the Drifting Moon", "return-to-player": "Return to Player",
  "mercenary-enrollment": "Mercenary Enrollment", "eleceed": "Eleceed",
  "windbreaker": "Windbreaker", "study-group": "Study Group", "weak-hero": "Weak Hero",
  "lookism": "Lookism", "god-of-blackfield": "God of Blackfield",
  "max-level-hero-returned": "Max Level Hero Has Returned", "overgeared": "Overgeared",
  "the-great-mage-returns-after-4000-years": "The Great Mage Returns After 4000 Years",
  "martial-peak": "Martial Peak", "apotheosis": "Apotheosis",
  "tales-of-demons-and-gods": "Tales of Demons and Gods",
  "star-martial-god-technique": "Star Martial God Technique", "magic-emperor": "Magic Emperor",
  "volcanic-age": "Volcanic Age", "chronicles-of-heavenly-demon": "Chronicles of Heavenly Demon",
  "medical-return": "Medical Return",
};

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

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
      const [users, comments, pendingComments, activeAds, seedUsers] = await Promise.all([
        _query("SELECT COUNT(*) as count FROM users"),
        _query("SELECT COUNT(*) as count FROM comments"),
        _query("SELECT COUNT(*) as count FROM comments WHERE status = 'pending'"),
        _query("SELECT COUNT(*) as count FROM ad_placements WHERE is_active = true"),
        _query("SELECT COUNT(*) as count FROM users WHERE is_seed = true"),
      ]);

      const recentComments = await _query(
        `SELECT c.id, c.content, c.comic_slug, c.comic_title, c.status, c.created_at,
                u.username, u.role as user_role
         FROM comments c JOIN users u ON c.user_id = u.id
         ORDER BY c.created_at DESC LIMIT 10`
      );

      return res.status(200).json({
        stats: {
          total_users: parseInt(users[0].count),
          total_comments: parseInt(comments[0].count),
          pending_comments: parseInt(pendingComments[0].count),
          active_ads: parseInt(activeAds[0].count),
          seed_users: parseInt(seedUsers[0].count),
        },
        recent_comments: recentComments,
      });
    }

    // ─── Users ───
    if (resource === "users") {
      if (req.method === "GET") {
        const rows = await _query(
          "SELECT id, username, email, role, avatar_url, is_seed, created_at FROM users ORDER BY created_at DESC"
        );
        return res.status(200).json({ users: rows });
      }
      // PATCH — edit username
      if (req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const id = parseInt(body.id);
        const username = body.username !== undefined ? String(body.username).trim().slice(0, 50) : null;

        if (!id) return res.status(400).json({ error: "User id required" });

        if (username !== null) {
          if (username.length < 1) return res.status(400).json({ error: "Username tidak boleh kosong" });
          // Check uniqueness
          const existing = await _query("SELECT id FROM users WHERE username = $1 AND id != $2", [username, id]);
          if (existing.length > 0) return res.status(400).json({ error: "Username sudah dipakai" });
          await _query("UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2", [username, id]);
          return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: "Nothing to update" });
      }
      if (req.method === "DELETE") {
        const id = parseInt(String(req.query.id));
        if (!id) return res.status(400).json({ error: "User id required" });
        if (id === admin.id) return res.status(400).json({ error: "Cannot delete yourself" });
        // Delete user's comments first, then user
        await _query("DELETE FROM comments WHERE user_id = $1", [id]);
        await _query("DELETE FROM users WHERE id = $1", [id]);
        return res.status(200).json({ success: true });
      }
      // PUT — reset password
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
      // POST — create user manually
      if (req.method === "POST") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const username = String(body.username || "").trim().slice(0, 50);
        const email = String(body.email || "").trim().slice(0, 255);
        const password = String(body.password || "");
        if (!username) return res.status(400).json({ error: "Username diperlukan" });
        if (!email) return res.status(400).json({ error: "Email diperlukan" });
        if (password.length < 6) return res.status(400).json({ error: "Password minimal 6 karakter" });
        // Check uniqueness
        const existing = await _query("SELECT id FROM users WHERE username = $1 OR email = $2", [username, email]);
        if (existing.length > 0) return res.status(400).json({ error: "Username atau email sudah dipakai" });
        const hash = await _bcrypt.hash(password, 10);
        const result = await _query(
          "INSERT INTO users (username, email, password_hash, role, is_seed) VALUES ($1, $2, $3, 'user', false) RETURNING id, username, email, role, created_at",
          [username, email, hash]
        );
        return res.status(201).json({ user: result[0] });
      }
    }

    // ─── Comments (admin view) ───
    if (resource === "comments") {
      if (req.method === "GET") {
        const status = req.query.status ? String(req.query.status) : null;
        let sql = `SELECT c.id, c.content, c.comic_slug, c.comic_title, c.chapter_slug,
                           c.parent_id, c.status, c.is_seed, c.created_at,
                           u.id as user_id, u.username, u.avatar_url, u.role as user_role
                    FROM comments c JOIN users u ON c.user_id = u.id`;
        const params: unknown[] = [];
        if (status && ["approved", "pending", "hidden"].includes(status)) {
          sql += " WHERE c.status = $1";
          params.push(status);
        }
        sql += " ORDER BY c.created_at DESC LIMIT 500";
        const rows = await _query(sql, params);
        return res.status(200).json({ comments: rows });
      }
      // PATCH — edit comment content or status
      if (req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const id = parseInt(body.id);
        if (!id) return res.status(400).json({ error: "Comment id required" });

        const content = body.content !== undefined ? String(body.content).replace(/<[^>]*>/g, "").trim().slice(0, 2000) : null;
        const status = body.status ? String(body.status) : null;

        if (content !== null) {
          if (content.length < 1) return res.status(400).json({ error: "Komentar tidak boleh kosong" });
          await _query("UPDATE comments SET content = $1, updated_at = NOW() WHERE id = $2", [content, id]);
        }
        if (status && ["approved", "pending", "hidden"].includes(status)) {
          await _query("UPDATE comments SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
        }
        if (!content && !status) return res.status(400).json({ error: "Nothing to update" });
        return res.status(200).json({ success: true });
      }
      if (req.method === "DELETE") {
        const id = parseInt(String(req.query.id));
        if (!id) return res.status(400).json({ error: "Comment id required" });
        await _query("DELETE FROM comments WHERE id = $1", [id]);
        return res.status(200).json({ success: true });
      }
      // POST — create comment manually from admin
      if (req.method === "POST") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const userId = parseInt(body.user_id);
        const comicSlug = String(body.comic_slug || "").trim();
        const comicTitle = String(body.comic_title || "").trim().slice(0, 500);
        const content = String(body.content || "").replace(/<[^>]*>/g, "").trim().slice(0, 2000);
        if (!userId) return res.status(400).json({ error: "User diperlukan" });
        if (!comicSlug) return res.status(400).json({ error: "Comic slug diperlukan" });
        if (!content) return res.status(400).json({ error: "Komentar tidak boleh kosong" });
        const result = await _query(
          "INSERT INTO comments (user_id, comic_slug, comic_title, content, status, is_seed) VALUES ($1, $2, $3, $4, 'approved', false) RETURNING id, content, comic_slug, created_at",
          [userId, comicSlug, comicTitle, content]
        );
        return res.status(201).json({ comment: result[0] });
      }
    }

    // ─── Seed Data ───
    if (resource === "seed") {
      // POST — seed fake users + comments
      if (req.method === "POST") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const userCount = Math.min(Math.max(parseInt(body.user_count) || 100, 10), 200);
        const commentCount = Math.min(Math.max(parseInt(body.comment_count) || 120, 10), 500);

        // Create fake users
        const usedNames = new Set<string>();
        const createdUserIds: number[] = [];
        for (let i = 0; i < userCount; i++) {
          let name = pickRandom(FAKE_NAMES);
          // Ensure unique by appending number if needed
          while (usedNames.has(name)) {
            name = pickRandom(FAKE_NAMES) + Math.floor(Math.random() * 999);
          }
          usedNames.add(name);
          const username = name.replace(/\s+/g, "").toLowerCase().slice(0, 50);
          const email = username + i + "@fakeseed.local";
          const hash = await _bcrypt.hash("seedpass123", 4); // fast low-cost hash
          try {
            const row = await _query(
              "INSERT INTO users (username, email, password_hash, role, is_seed) VALUES ($1, $2, $3, 'user', true) RETURNING id",
              [name, email, hash]
            );
            createdUserIds.push(row[0].id);
          } catch { /* skip duplicates */ }
        }

        // Create fake comments spread across random comics
        let commentsCreated = 0;
        for (let i = 0; i < commentCount; i++) {
          const userId = pickRandom(createdUserIds.length > 0 ? createdUserIds : [admin.id]);
          const slug = pickRandom(COMIC_SLUGS);
          const title = COMIC_TITLES[slug] || slug;
          const content = pickRandom(FAKE_COMMENTS);
          // Random date within last 90 days
          const daysAgo = Math.floor(Math.random() * 90);
          const hoursAgo = Math.floor(Math.random() * 24);
          try {
            await _query(
              `INSERT INTO comments (user_id, comic_slug, comic_title, content, status, is_seed, created_at)
               VALUES ($1, $2, $3, $4, 'approved', true, NOW() - INTERVAL '${daysAgo} days' - INTERVAL '${hoursAgo} hours')`,
              [userId, slug, title, content]
            );
            commentsCreated++;
          } catch { /* skip errors */ }
        }

        return res.status(201).json({
          success: true,
          created_users: createdUserIds.length,
          created_comments: commentsCreated,
        });
      }

      // DELETE — remove all seed data
      if (req.method === "DELETE") {
        const [delComments] = await Promise.all([
          _query("DELETE FROM comments WHERE is_seed = true"),
        ]);
        const delUsers = await _query("DELETE FROM users WHERE is_seed = true");
        return res.status(200).json({
          success: true,
          deleted_comments: delComments?.length ?? 0,
          deleted_users: delUsers?.length ?? 0,
          message: "Semua data seed berhasil dihapus",
        });
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
