import type { VercelRequest, VercelResponse } from "@vercel/node";

let _query: any;
let _jwt: any;
let _bcrypt: any;
let _seedColsMigrated = false;
let _analyticsTableEnsured = false;
let _publicAnalyticsCache: { value: any; expiresAt: number } | null = null;
const ANALYTICS_PUBLIC_CACHE_TTL = 60_000;

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
      await _query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_free BOOLEAN DEFAULT false");
      // Fix: non-admin users should not be ad-free
      await _query("UPDATE users SET ad_free = false WHERE role NOT IN ('admin', 'owner') AND ad_free = true");
      await _query("UPDATE users SET ad_free = true WHERE role IN ('admin', 'owner')");
      await _query("ALTER TABLE users ALTER COLUMN ad_free SET DEFAULT false");
      // Ensure role constraint includes 'owner'
      try {
        await _query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        await _query("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'owner'))");
      } catch { /* constraint may already exist */ }
      // Migrate first admin to owner (only if no owner exists yet)
      const ownerCheck = await _query("SELECT id FROM users WHERE role = 'owner' LIMIT 1");
      if (ownerCheck.length === 0) {
        await _query("UPDATE users SET role = 'owner' WHERE id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1)");
      }
      await _query("ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT false");
      // Rename old slot names to new ones
      await _query("UPDATE ad_placements SET slot_name = 'home-bottom-1', label = 'Banner Bawah Homepage 1', position = 'home' WHERE slot_name = 'home-bottom'");
      await _query("UPDATE ad_placements SET slot_name = 'home-bottom-2', label = 'Banner Bawah Homepage 2', position = 'home' WHERE slot_name = 'sticky-mobile'");
      // Ensure new ad slots exist
      await _query(`INSERT INTO ad_placements (slot_name, label, position, is_active) VALUES
        ('popup-global', 'Banner di Bawah Navbar (Global)', 'global', false),
        ('native-detail', 'Native Banner Detail Page', 'detail', false),
        ('home-bottom-1', 'Banner Bawah Homepage 1', 'home', false),
        ('home-bottom-2', 'Banner Bawah Homepage 2', 'home', false),
        ('browse-banner', 'Banner Genre & Pencarian', 'home', false)
        ON CONFLICT (slot_name) DO NOTHING`);
      // Remove deprecated ad slots
      await _query("DELETE FROM ad_placements WHERE slot_name IN ('popunder-global', 'socialbar-global')");
    } catch { /* ignore if already exists or table missing */ }
    _seedColsMigrated = true;
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
    return payload;
  } catch { return null; }
}

async function verifyAdmin(req: VercelRequest): Promise<any> {
  const payload = getAdmin(req);
  if (!payload) return null;
  const rows = await _query("SELECT id, username, role FROM users WHERE id = $1", [payload.id]);
  if (rows.length === 0) return null;
  const user = rows[0];
  if (user.role !== 'admin' && user.role !== 'owner') return null;
  return { ...payload, role: user.role };
}

async function ensureAnalyticsTable() {
  if (_analyticsTableEnsured) return;
  try {
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
  } catch { /* ignore */ }
  _analyticsTableEnsured = true;
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

const COMIC_SLUGS: string[] = [];
const COMIC_TITLES: Record<string, string> = {};

// Fetch real manga slugs from Shinigami API
async function loadRealComicSlugs() {
  if (COMIC_SLUGS.length > 0) return;
  try {
    const { request } = await import("undici");
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json",
      Origin: "https://09.shinigami.asia",
      Referer: "https://09.shinigami.asia/",
    };
    // Fetch popular/recommended + top manga in parallel to get 30+ real slugs
    const [recRes, topRes] = await Promise.all([
      request("https://api.shngm.io/v1/manga/list?page=1&page_size=20&sort=latest&sort_order=desc&is_recommended=true", { headers }).catch(() => null),
      request("https://api.shngm.io/v1/manga/top?page=1&page_size=20", { headers }).catch(() => null),
    ]);
    const seen = new Set<string>();
    for (const resp of [recRes, topRes]) {
      if (!resp) continue;
      try {
        const text = await resp.body.text();
        const data = JSON.parse(text);
        const list = data?.data || data?.manga_list || data || [];
        const items = Array.isArray(list) ? list : [];
        for (const m of items) {
          const id = m.manga_id || m.id || m.slug;
          const title = m.title || m.name || "";
          if (id && !seen.has(String(id))) {
            seen.add(String(id));
            COMIC_SLUGS.push(String(id));
            COMIC_TITLES[String(id)] = String(title);
          }
        }
      } catch { /* skip parse errors */ }
    }
  } catch { /* fetch failed, will use fallback */ }
  // Fallback if API returned nothing
  if (COMIC_SLUGS.length === 0) {
    COMIC_SLUGS.push("solo-leveling", "one-piece", "tower-of-god");
    COMIC_TITLES["solo-leveling"] = "Solo Leveling";
    COMIC_TITLES["one-piece"] = "One Piece";
    COMIC_TITLES["tower-of-god"] = "Tower of God";
  }
}

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
  await loadAll();

  // Public endpoints (used by API dashboard page — no auth required)
  const earlyPath = (req.url || "").split("?")[0].replace(/^\/api\/admin\/?/, "");
  const earlyResource = earlyPath.split("/")[0] || "";

  if (earlyResource === "analytics" && req.method === "GET" && String(req.query.public || "") === "1") {
    const now = Date.now();
    if (_publicAnalyticsCache && _publicAnalyticsCache.expiresAt > now) {
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      return res.status(200).json(_publicAnalyticsCache.value);
    }

    await ensureAnalyticsTable();

    const [
      totalRequests,
      uniqueVisitors,
      todayRequests,
      todayVisitors,
      topProviders,
      topCountries,
      dailyStats,
      weekRequests,
      weekVisitors,
      monthRequests,
      monthVisitors,
      monthDailyActivity,
    ] = await Promise.all([
      _query("SELECT COUNT(*) as count FROM api_analytics"),
      _query("SELECT COUNT(DISTINCT ip_hash) as count FROM api_analytics"),
      _query("SELECT COUNT(*) as count FROM api_analytics WHERE created_at >= CURRENT_DATE"),
      _query("SELECT COUNT(DISTINCT ip_hash) as count FROM api_analytics WHERE created_at >= CURRENT_DATE"),
      _query("SELECT provider, COUNT(*) as count FROM api_analytics WHERE provider IS NOT NULL GROUP BY provider ORDER BY count DESC"),
      _query("SELECT country, COUNT(*) as count FROM api_analytics WHERE country IS NOT NULL AND country != '' GROUP BY country ORDER BY count DESC LIMIT 10"),
      _query(`SELECT DATE(created_at) as date, COUNT(*) as count, COUNT(DISTINCT ip_hash) as visitors 
              FROM api_analytics WHERE created_at >= NOW() - INTERVAL '30 days' 
              GROUP BY date ORDER BY date`),
      _query("SELECT COUNT(*) as count FROM api_analytics WHERE created_at >= NOW() - INTERVAL '7 days'"),
      _query("SELECT COUNT(DISTINCT ip_hash) as count FROM api_analytics WHERE created_at >= NOW() - INTERVAL '7 days'"),
      _query("SELECT COUNT(*) as count FROM api_analytics WHERE created_at >= date_trunc('month', CURRENT_DATE)"),
      _query("SELECT COUNT(DISTINCT ip_hash) as count FROM api_analytics WHERE created_at >= date_trunc('month', CURRENT_DATE)"),
      _query(`SELECT DATE(created_at) as date, COUNT(*) as requests, COUNT(DISTINCT ip_hash) as visitors 
              FROM api_analytics WHERE created_at >= date_trunc('month', CURRENT_DATE) 
              GROUP BY DATE(created_at) ORDER BY date DESC`),
    ]);

    const payload = {
      restricted: true,
      message: "Mode publik dibatasi untuk menghemat Neon compute.",
      total_requests: parseInt(totalRequests[0]?.count || "0"),
      unique_visitors: parseInt(uniqueVisitors[0]?.count || "0"),
      today_requests: parseInt(todayRequests[0]?.count || "0"),
      today_visitors: parseInt(todayVisitors[0]?.count || "0"),
      week_requests: parseInt(weekRequests[0]?.count || "0"),
      week_visitors: parseInt(weekVisitors[0]?.count || "0"),
      top_providers: topProviders,
      top_countries: topCountries,
      daily_30d: dailyStats,
      top_endpoints: [],
      recent_requests: [],
      top_comics: [],
      recent_comic_clicks: [],
      recent_visitors: [],
      monthly: {
        requests: parseInt(monthRequests[0]?.count || "0"),
        visitors: parseInt(monthVisitors[0]?.count || "0"),
        daily_activity: monthDailyActivity,
      },
    };

    _publicAnalyticsCache = {
      value: payload,
      expiresAt: now + ANALYTICS_PUBLIC_CACHE_TTL,
    };
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(payload);
  }

  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: "Admin access required" });

  const path = (req.url || "").split("?")[0].replace(/^\/api\/admin\/?/, "");
  const resource = path.split("/")[0] || "";

    if (resource === "clear-monthly" && req.method === "POST") {
      await ensureAnalyticsTable();
      await _query("DELETE FROM api_analytics WHERE created_at < date_trunc('month', CURRENT_DATE)");
      _publicAnalyticsCache = null;
      return res.status(200).json({ success: true, message: "Data bulan lalu berhasil dihapus" });
    }

    if (resource === "analytics" && req.method === "GET") {
      await ensureAnalyticsTable();

      const [
        totalRequests,
        uniqueVisitors,
        todayRequests,
        todayVisitors,
        topEndpoints,
        topProviders,
        topCountries,
        hourlyStats,
        dailyStats,
        recentRequests,
        weekRequests,
        weekVisitors,
        topComics,
        recentComicClicks,
        recentVisitors,
        monthRequests,
        monthVisitors,
        monthDailyActivity,
      ] = await Promise.all([
        _query("SELECT COUNT(*) as count FROM api_analytics"),
        _query("SELECT COUNT(DISTINCT ip_hash) as count FROM api_analytics"),
        _query("SELECT COUNT(*) as count FROM api_analytics WHERE created_at >= CURRENT_DATE"),
        _query("SELECT COUNT(DISTINCT ip_hash) as count FROM api_analytics WHERE created_at >= CURRENT_DATE"),
        _query("SELECT endpoint, COUNT(*) as count FROM api_analytics GROUP BY endpoint ORDER BY count DESC LIMIT 10"),
        _query("SELECT provider, COUNT(*) as count FROM api_analytics WHERE provider IS NOT NULL GROUP BY provider ORDER BY count DESC"),
        _query("SELECT country, COUNT(*) as count FROM api_analytics WHERE country IS NOT NULL AND country != '' GROUP BY country ORDER BY count DESC LIMIT 10"),
        _query(`SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count 
                FROM api_analytics WHERE created_at >= CURRENT_DATE 
                GROUP BY hour ORDER BY hour`),
        _query(`SELECT DATE(created_at) as date, COUNT(*) as count, COUNT(DISTINCT ip_hash) as visitors 
                FROM api_analytics WHERE created_at >= NOW() - INTERVAL '30 days' 
                GROUP BY date ORDER BY date`),
        _query(`SELECT endpoint, provider, country, created_at 
                FROM api_analytics ORDER BY created_at DESC LIMIT 20`),
        _query("SELECT COUNT(*) as count FROM api_analytics WHERE created_at >= NOW() - INTERVAL '7 days'"),
        _query("SELECT COUNT(DISTINCT ip_hash) as count FROM api_analytics WHERE created_at >= NOW() - INTERVAL '7 days'"),
        _query(`SELECT a.endpoint, COUNT(*) as count, COUNT(DISTINCT a.ip_hash) as unique_viewers,
                MAX(cv.comic_title) as comic_title
                FROM api_analytics a
                LEFT JOIN comic_views cv ON cv.comic_slug = REPLACE(a.endpoint, '/detail/', '')
                WHERE a.endpoint LIKE '/detail/%' 
                GROUP BY a.endpoint ORDER BY count DESC LIMIT 15`).catch(() => []),
        _query(`SELECT a.ip_hash, a.endpoint, a.provider, a.country, a.user_agent, a.created_at,
                cv.comic_title
                FROM api_analytics a
                LEFT JOIN comic_views cv ON cv.comic_slug = REPLACE(a.endpoint, '/detail/', '')
                WHERE a.endpoint LIKE '/detail/%' 
                ORDER BY a.created_at DESC LIMIT 30`).catch(() => []),
        _query(`SELECT ip_hash, COUNT(*) as total_requests,
                       COUNT(DISTINCT endpoint) as pages_viewed,
                       COUNT(CASE WHEN endpoint LIKE '/detail/%' THEN 1 END) as comic_clicks,
                       MAX(created_at) as last_seen,
                       MIN(created_at) as first_seen,
                       MAX(country) as country,
                       MAX(user_agent) as user_agent
                FROM api_analytics 
                GROUP BY ip_hash 
                ORDER BY last_seen DESC LIMIT 30`),
        _query("SELECT COUNT(*) as count FROM api_analytics WHERE created_at >= date_trunc('month', CURRENT_DATE)"),
        _query("SELECT COUNT(DISTINCT ip_hash) as count FROM api_analytics WHERE created_at >= date_trunc('month', CURRENT_DATE)"),
        _query(`SELECT DATE(created_at) as date, COUNT(*) as requests, COUNT(DISTINCT ip_hash) as visitors 
                FROM api_analytics WHERE created_at >= date_trunc('month', CURRENT_DATE) 
                GROUP BY DATE(created_at) ORDER BY date DESC`),
      ]);

      res.setHeader("Cache-Control", "private, no-store");
      return res.status(200).json({
        restricted: false,
        total_requests: parseInt(totalRequests[0]?.count || "0"),
        unique_visitors: parseInt(uniqueVisitors[0]?.count || "0"),
        today_requests: parseInt(todayRequests[0]?.count || "0"),
        today_visitors: parseInt(todayVisitors[0]?.count || "0"),
        week_requests: parseInt(weekRequests[0]?.count || "0"),
        week_visitors: parseInt(weekVisitors[0]?.count || "0"),
        top_endpoints: topEndpoints,
        top_providers: topProviders,
        top_countries: topCountries,
        hourly_today: hourlyStats,
        daily_30d: dailyStats,
        recent_requests: recentRequests,
        top_comics: topComics,
        recent_comic_clicks: recentComicClicks,
        recent_visitors: recentVisitors,
        monthly: {
          requests: parseInt(monthRequests[0]?.count || "0"),
          visitors: parseInt(monthVisitors[0]?.count || "0"),
          daily_activity: monthDailyActivity,
        },
      });
    }

    // ─── Stats ───
    if (resource === "stats" && req.method === "GET") {
      const [users, comments, pendingComments, activeAds, seedUsers] = await Promise.all([
        _query("SELECT COUNT(*) as count FROM users"),
        _query("SELECT COUNT(*) as count FROM comments"),
        _query("SELECT COUNT(*) as count FROM comments WHERE status = 'pending'"),
        _query("SELECT COUNT(*) as count FROM ad_placements WHERE is_active = true"),
        _query("SELECT COUNT(*) as count FROM users WHERE is_seed = true"),
      ]);

      // Monthly stats
      const [monthUsers, monthComments, monthViews, monthTopComics, dailyActivity] = await Promise.all([
        _query("SELECT COUNT(*) as count FROM users WHERE created_at >= date_trunc('month', CURRENT_DATE)"),
        _query("SELECT COUNT(*) as count FROM comments WHERE created_at >= date_trunc('month', CURRENT_DATE)"),
        _query("SELECT COALESCE(SUM(view_count), 0) as total, COUNT(*) as comics FROM comic_views").catch(() => [{ total: 0, comics: 0 }]),
        _query(`SELECT comic_slug, comic_title, comic_type, view_count, weekly_views 
                FROM comic_views ORDER BY view_count DESC LIMIT 5`).catch(() => []),
        _query(`SELECT DATE(created_at) as date, COUNT(*) as requests, COUNT(DISTINCT ip_hash) as visitors 
                FROM api_analytics WHERE created_at >= date_trunc('month', CURRENT_DATE) 
                GROUP BY DATE(created_at) ORDER BY date DESC`).catch(() => []),
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
        monthly: {
          new_users: parseInt(monthUsers[0]?.count || "0"),
          new_comments: parseInt(monthComments[0]?.count || "0"),
          total_views: parseInt(monthViews[0]?.total || "0"),
          tracked_comics: parseInt(monthViews[0]?.comics || "0"),
          top_comics: monthTopComics,
          daily_activity: dailyActivity,
        },
        recent_comments: recentComments,
      });
    }

    // ─── Users ───
    if (resource === "users") {
      if (req.method === "GET") {
        const rows = await _query(
          "SELECT id, username, email, role, avatar_url, is_seed, ad_free, created_at FROM users ORDER BY created_at DESC"
        );
        return res.status(200).json({ users: rows });
      }
      // PATCH — edit username
      if (req.method === "PATCH") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const id = parseInt(body.id);
        const username = body.username !== undefined ? String(body.username).trim().slice(0, 50) : null;
        const adFree = body.ad_free !== undefined ? Boolean(body.ad_free) : null;

        if (!id) return res.status(400).json({ error: "User id required" });

        if (username !== null) {
          if (username.length < 1) return res.status(400).json({ error: "Username tidak boleh kosong" });
          // Check uniqueness
          const existing = await _query("SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2", [username, id]);
          if (existing.length > 0) return res.status(400).json({ error: "Username sudah dipakai" });
          await _query("UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2", [username, id]);
          return res.status(200).json({ success: true });
        }

        if (adFree !== null) {
          await _query("UPDATE users SET ad_free = $1, updated_at = NOW() WHERE id = $2", [adFree, id]);
          return res.status(200).json({ success: true });
        }

        // Promote/demote role (owner only)
        const newRole = body.role !== undefined ? String(body.role) : null;
        if (newRole !== null) {
          if (!['user', 'admin'].includes(newRole)) return res.status(400).json({ error: "Role tidak valid" });
          // Only owner can change roles
          const caller = await _query("SELECT role FROM users WHERE id = $1", [admin.id]);
          if (caller.length === 0 || caller[0].role !== 'owner') return res.status(403).json({ error: "Hanya owner yang dapat mengubah role" });
          // Cannot change own role or another owner
          const target = await _query("SELECT role FROM users WHERE id = $1", [id]);
          if (target.length === 0) return res.status(404).json({ error: "User tidak ditemukan" });
          if (target[0].role === 'owner') return res.status(400).json({ error: "Tidak dapat mengubah role owner" });
          await _query("UPDATE users SET role = $1, ad_free = $2, updated_at = NOW() WHERE id = $3", [newRole, newRole === 'admin', id]);
          return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: "Nothing to update" });
      }
      if (req.method === "DELETE") {
        const id = parseInt(String(req.query.id));
        if (!id) return res.status(400).json({ error: "User id required" });
        if (id === admin.id) return res.status(400).json({ error: "Cannot delete yourself" });
        // Only owner can delete admins
        const targetUser = await _query("SELECT role FROM users WHERE id = $1", [id]);
        if (targetUser.length > 0 && targetUser[0].role === 'owner') return res.status(400).json({ error: "Tidak dapat menghapus owner" });
        if (targetUser.length > 0 && targetUser[0].role === 'admin') {
          const caller = await _query("SELECT role FROM users WHERE id = $1", [admin.id]);
          if (caller.length === 0 || caller[0].role !== 'owner') return res.status(403).json({ error: "Hanya owner yang dapat menghapus admin" });
        }
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
        const existing = await _query(
          "SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)",
          [username, email]
        );
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

        // Auto-clean old seed data first to avoid conflicts
        await _query("DELETE FROM comments WHERE is_seed = true");
        await _query("DELETE FROM users WHERE is_seed = true");

        // Hash password ONCE instead of 100 times (biggest perf win)
        const seedHash = await _bcrypt.hash("seedpass123", 4);

        // Generate unique names
        const usedNames = new Set<string>();
        const userData: { name: string; email: string }[] = [];
        const ts = Date.now();
        for (let i = 0; i < userCount; i++) {
          let name = pickRandom(FAKE_NAMES);
          if (usedNames.has(name)) name = name + Math.floor(Math.random() * 9999);
          while (usedNames.has(name)) name = pickRandom(FAKE_NAMES) + Math.floor(Math.random() * 99999);
          usedNames.add(name);
          userData.push({ name, email: name.replace(/\s+/g, "").toLowerCase() + i + "_" + ts + "@seed.local" });
        }

        // Batch INSERT users (25 per query instead of 100 individual queries)
        const BATCH = 25;
        const createdUserIds: number[] = [];
        for (let b = 0; b < userData.length; b += BATCH) {
          const chunk = userData.slice(b, b + BATCH);
          const values: string[] = [];
          const params: unknown[] = [];
          let p = 1;
          for (const u of chunk) {
            values.push(`($${p}, $${p + 1}, $${p + 2}, 'user', true)`);
            params.push(u.name, u.email, seedHash);
            p += 3;
          }
          try {
            const rows = await _query(
              `INSERT INTO users (username, email, password_hash, role, is_seed) VALUES ${values.join(", ")} RETURNING id`,
              params
            );
            for (const r of rows) createdUserIds.push(r.id);
          } catch (e) { console.error("Seed user batch error:", e); }
        }

        // Batch INSERT comments (25 per query instead of 120 individual queries)
        // First, fetch REAL comic slugs from Shinigami API
        await loadRealComicSlugs();
        let commentsCreated = 0;
        const pool = createdUserIds.length > 0 ? createdUserIds : [admin.id];
        for (let b = 0; b < commentCount; b += BATCH) {
          const end = Math.min(b + BATCH, commentCount);
          const count = end - b;
          const values: string[] = [];
          const params: unknown[] = [];
          let p = 1;
          for (let i = 0; i < count; i++) {
            const userId = pickRandom(pool);
            const slug = pickRandom(COMIC_SLUGS);
            const title = COMIC_TITLES[slug] || slug;
            const content = pickRandom(FAKE_COMMENTS);
            const msAgo = (Math.floor(Math.random() * 90) * 86400 + Math.floor(Math.random() * 86400)) * 1000;
            const createdAt = new Date(Date.now() - msAgo).toISOString();
            values.push(`($${p}, $${p + 1}, $${p + 2}, $${p + 3}, 'approved', true, $${p + 4})`);
            params.push(userId, slug, title, content, createdAt);
            p += 5;
          }
          try {
            const rows = await _query(
              `INSERT INTO comments (user_id, comic_slug, comic_title, content, status, is_seed, created_at) VALUES ${values.join(", ")} RETURNING id`,
              params
            );
            commentsCreated += rows.length;
          } catch (e) { console.error("Seed comment batch error:", e); }
        }

        return res.status(201).json({
          success: true,
          created_users: createdUserIds.length,
          created_comments: commentsCreated,
        });
      }

      // DELETE — remove all seed data
      if (req.method === "DELETE") {
        const delComments = await _query("DELETE FROM comments WHERE is_seed = true RETURNING id");
        const delUsers = await _query("DELETE FROM users WHERE is_seed = true RETURNING id");
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
      if (req.method === "POST") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const slotName = String(body.slot_name || "").replace(/[^a-zA-Z0-9\-_]/g, "").slice(0, 100);
        const label = String(body.label || "").slice(0, 255);
        const position = String(body.position || "home").replace(/[^a-zA-Z0-9\-_]/g, "").slice(0, 50);
        const adSize = String(body.ad_size || "").slice(0, 50);
        if (!slotName || !label) return res.status(400).json({ error: "slot_name dan label wajib diisi" });
        // Check duplicate
        const existing = await _query("SELECT id FROM ad_placements WHERE slot_name = $1", [slotName]);
        if (existing.length > 0) return res.status(409).json({ error: "Slot name sudah ada" });
        await _query(
          "INSERT INTO ad_placements (slot_name, label, position, ad_code, is_active) VALUES ($1, $2, $3, '', false)",
          [slotName, label, position]
        );
        return res.status(201).json({ success: true });
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
      if (req.method === "DELETE") {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
        const id = parseInt(body.id);
        if (!id) return res.status(400).json({ error: "Ad id required" });
        await _query("DELETE FROM ad_placements WHERE id = $1", [id]);
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
