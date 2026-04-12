import type { VercelRequest, VercelResponse } from "@vercel/node";
import { request } from "undici";
import crypto from "crypto";
import * as cheerio from "cheerio";

// ─── Security Config ───
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
const API_SECRET = process.env.API_SECRET || "";

// Rate limiting per IP (in-memory, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 60; // max requests per window
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
// Cleanup expired entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

function getRateLimitKey(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "unknown";
  return ip;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Validate request token (HMAC-based)
function generateToken(timestamp: string): string {
  if (!API_SECRET) return "";
  return crypto.createHmac("sha256", API_SECRET).update(timestamp).digest("hex").slice(0, 16);
}

function isValidToken(req: VercelRequest): boolean {
  // If no API_SECRET is set, skip token validation
  if (!API_SECRET) return true;
  const token = req.headers["x-api-token"] as string;
  const timestamp = req.headers["x-api-timestamp"] as string;
  if (!token || !timestamp) return false;
  // Reject if timestamp is older than 5 minutes
  const ts = parseInt(timestamp);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > 300_000) return false;
  return token === generateToken(timestamp);
}

// Input sanitization — reject dangerous patterns
function isSafeInput(value: string): boolean {
  // Block SQL injection, script injection, path traversal
  const dangerous = /(<script|javascript:|on\w+=|union\s+select|drop\s+table|--|;.*--|\.\.\/|\.\.\\)/i;
  return !dangerous.test(value);
}

function sanitizeSlug(slug: string): string {
  // Only allow alphanumeric, hyphens, underscores
  return slug.replace(/[^a-zA-Z0-9\-_.]/g, "");
}

// ─── Shinigami API Config ───
const API_BASE = "https://api.shngm.io/v1";
const MAX_RETRIES = 3;
const RETRY_DELAY = 500;

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://09.shinigami.asia",
  Referer: "https://09.shinigami.asia/",
};

// ─── Fetch with retry ───
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<unknown> {
  for (let i = 0; i < retries; i++) {
    try {
      const { statusCode, body } = await request(url, { headers: DEFAULT_HEADERS });
      const text = await body.text();
      if (statusCode === 200) return JSON.parse(text);
      return JSON.parse(text);
    } catch {
      if (i < retries - 1) await new Promise((r) => setTimeout(r, RETRY_DELAY));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

// ─── HTML Scraping Utility ───
async function fetchHTML(url: string): Promise<cheerio.CheerioAPI> {
  const { statusCode, body } = await request(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
  });
  const html = await body.text();
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode} from ${url}`);
  return cheerio.load(html);
}

// ─── Shinigami API calls ───
interface MangaListParams {
  page?: number;
  page_size?: number;
  sort?: string;
  sort_order?: string;
  q?: string;
  is_recommended?: boolean;
  genre?: string;
}

async function getMangaList(params: MangaListParams = {}) {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page || 1));
  sp.set("page_size", String(params.page_size || 20));
  sp.set("sort", params.sort || "latest");
  sp.set("sort_order", params.sort_order || "desc");
  if (params.q) sp.set("q", params.q);
  if (params.is_recommended) sp.set("is_recommended", "true");
  if (params.genre) sp.set("genre", params.genre);
  return fetchWithRetry(`${API_BASE}/manga/list?${sp.toString()}`);
}

async function getMangaTop(page = 1, pageSize = 20) {
  const sp = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  return fetchWithRetry(`${API_BASE}/manga/top?${sp.toString()}`);
}

async function getMangaDetail(id: string) {
  return fetchWithRetry(`${API_BASE}/manga/detail/${encodeURIComponent(id)}`);
}

async function getChapterList(mangaId: string) {
  const sp = new URLSearchParams({
    sort_by: "chapter_number",
    sort_order: "desc",
    page: "1",
    page_size: "500",
  });
  return fetchWithRetry(`${API_BASE}/chapter/${encodeURIComponent(mangaId)}/list?${sp.toString()}`);
}

async function getChapterDetail(id: string) {
  return fetchWithRetry(`${API_BASE}/chapter/detail/${encodeURIComponent(id)}`);
}

async function getGenreList() {
  return fetchWithRetry(`${API_BASE}/genre/list`);
}

// ─── Transformers ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTypeFromCountry(c: string) {
  const u = c.toUpperCase();
  return u === "KR" ? "Manhwa" : u === "CN" ? "Manhua" : "Manga";
}

function resolveComicType(m: any): string {
  // country_id is the most reliable source — normalize to uppercase for comparison
  const cid = (m.country_id || "").toUpperCase();
  if (cid === "KR") return "Manhwa";
  if (cid === "CN") return "Manhua";
  if (cid === "JP") return "Manga";
  // Fallback to Format taxonomy
  const formatName = m.taxonomy?.Format?.[0]?.name;
  if (formatName && /^(Manhwa|Manhua|Manga)$/i.test(formatName)) {
    return formatName.charAt(0).toUpperCase() + formatName.slice(1).toLowerCase();
  }
  // Fallback to alternative_title language detection
  const alt = m.alternative_title || "";
  if (/[\uAC00-\uD7AF]/.test(alt)) return "Manhwa"; // Korean characters
  if (/[\u4E00-\u9FFF]/.test(alt) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(alt)) return "Manhua"; // Chinese without Japanese kana
  return cid ? getTypeFromCountry(cid) : "Manga";
}
function getStatusText(s: number) {
  return s === 1 ? "Ongoing" : s === 2 ? "Completed" : s === 3 ? "Hiatus" : "Unknown";
}

// ─── AniList Status (authoritative source) ───
const anilistCache = new Map<string, { status: string; ts: number }>();
const ANILIST_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function mapAniListStatus(s: string): string {
  switch (s) {
    case "FINISHED": return "Completed";
    case "RELEASING": return "Ongoing";
    case "HIATUS": return "Hiatus";
    case "NOT_YET_RELEASED": return "Upcoming";
    case "CANCELLED": return "Cancelled";
    default: return "Unknown";
  }
}

async function fetchAniListStatus(title: string): Promise<string> {
  if (!title) return "Unknown";
  const key = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cached = anilistCache.get(key);
  if (cached && Date.now() - cached.ts < ANILIST_CACHE_TTL) return cached.status;
  try {
    const query = `query ($search: String) { Media(search: $search, type: MANGA) { status } }`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { search: title } }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!resp.ok) return "Unknown";
    const json = await resp.json() as { data?: { Media?: { status?: string } } };
    const raw = json.data?.Media?.status || "";
    const status = mapAniListStatus(raw);
    anilistCache.set(key, { status, ts: Date.now() });
    return status;
  } catch {
    return "Unknown";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformComic(m: any) {
  return {
    title: m.title,
    thumbnail: m.cover_image_url,
    image: m.cover_image_url,
    href: `/manga/${m.manga_id}`,
    type: resolveComicType(m),
    chapter: m.latest_chapter_number ? `Chapter ${m.latest_chapter_number}` : undefined,
    rating: m.user_rate || undefined,
    description: m.description,
    genre: m.taxonomy?.Genre?.map((g: { name: string }) => g.name).join(", "),
    status: getStatusText(m.status),
    author: m.taxonomy?.Author?.map((a: { name: string }) => a.name).join(", "),
    view_count: m.view_count || undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformComicDetail(m: any) {
  return {
    title: m.title,
    thumbnail: m.cover_image_url,
    image: m.cover_image_url,
    description: m.description,
    type: resolveComicType(m),
    status: getStatusText(m.status),
    author: m.taxonomy?.Author?.map((a: { name: string }) => a.name).join(", "),
    artist: m.taxonomy?.Artist?.map((a: { name: string }) => a.name).join(", "),
    genre: m.taxonomy?.Genre?.map((g: { name: string; slug: string }) => ({
      title: g.name,
      href: `/genre/${g.slug}`,
    })) || [],
    rating: m.user_rate || undefined,
    chapters: [],
    alternative: m.alternative_title,
    released: m.release_year,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformChapters(chapters: any[]) {
  return chapters.map((ch) => ({
    title: ch.chapter_title || `Chapter ${ch.chapter_number}`,
    href: `/chapter/${ch.chapter_id}`,
    date: ch.release_date || ch.created_at,
    number: ch.chapter_number,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformChapterData(detail: any) {
  const baseUrl = detail.base_url || "https://assets.shngm.id";
  const p = detail.chapter?.path || "";
  const panels = (detail.chapter?.data || []).map((f: string) => `${baseUrl}${p}${f}`);
  return {
    title: detail.chapter_title || `Chapter ${detail.chapter_number}`,
    panel: panels,
    prev_chapter_id: detail.prev_chapter_id,
    next_chapter_id: detail.next_chapter_id,
    chapter_number: detail.chapter_number,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformGenres(genres: any[]) {
  return genres.map((g) => ({ title: g.name, href: `/genre/${g.slug}` }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformPagination(meta: any) {
  const page = meta?.page || 1;
  const totalPage = meta?.total_page || 1;
  return { current_page: page, length_page: totalPage, has_next: page < totalPage, has_prev: page > 1 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function apiResponse(data: any, pagination?: any) {
  return { status: "success", data, ...pagination };
}

function apiError(message: string, code = 500) {
  return { status: "error", message, code };
}

// ─── Route handlers ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shinigamiHandlers: Record<string, (query: any, slug?: string) => Promise<any>> = {
  terbaru: async (query) => {
    const page = parseInt(query.page) || 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getMangaList({ page, page_size: 20, sort: "latest", sort_order: "desc" });
    if (result.retcode !== 0) throw new Error("Failed to fetch latest");
    return apiResponse((result.data || []).map(transformComic), transformPagination(result.meta));
  },

  popular: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getMangaTop(1, 30);
    if (result.retcode !== 0) throw new Error("Failed to fetch popular");
    return apiResponse((result.data || []).map(transformComic));
  },

  recommended: async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getMangaList({ page: 1, page_size: 30, sort: "latest", sort_order: "desc", is_recommended: true });
    if (result.retcode !== 0) throw new Error("Failed to fetch recommended");
    return apiResponse((result.data || []).map(transformComic));
  },

  search: async (query) => {
    const keyword = query.keyword;
    if (!keyword) return apiError("Parameter 'keyword' diperlukan", 400);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getMangaList({ page: 1, page_size: 30, sort: "latest", sort_order: "desc", q: keyword });
    if (result.retcode !== 0) throw new Error("Failed to search");
    return apiResponse((result.data || []).map(transformComic));
  },

  detail: async (_query, slug) => {
    if (!slug) return apiError("Slug required", 400);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [detailResult, chapterResult]: any[] = await Promise.all([
      getMangaDetail(slug),
      getChapterList(slug),
    ]);
    if (detailResult.retcode !== 0) return apiError("Comic not found", 404);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comic: any = transformComicDetail(detailResult.data);
    comic.chapters = chapterResult.retcode === 0 ? transformChapters(chapterResult.data || []) : [];
    // Override status with AniList (authoritative)
    const aniStatus = await fetchAniListStatus(comic.title);
    if (aniStatus !== "Unknown") comic.status = aniStatus;
    // Cross-provider chapter merge: fill missing early chapters from other providers
    comic.chapters = await mergeChaptersFromOtherProviders(comic.chapters, comic.title, "shinigami", comic.alternative);
    return apiResponse(comic);
  },

  read: async (_query, slug) => {
    if (!slug) return apiError("Slug required", 400);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getChapterDetail(slug);
    if (result.retcode !== 0) return apiError("Chapter not found", 404);
    return apiResponse([transformChapterData(result.data)]);
  },

  genre: async (query, slug) => {
    if (slug) {
      const page = parseInt(query.page) || 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await getMangaList({ page, page_size: 20, sort: "latest", sort_order: "desc", genre: slug });
      if (result.retcode !== 0) throw new Error("Failed to fetch genre comics");
      return apiResponse((result.data || []).map(transformComic), transformPagination(result.meta));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getGenreList();
    if (result.retcode !== 0) throw new Error("Failed to fetch genres");
    return apiResponse(transformGenres(result.data || []));
  },

  health: async () => ({
    status: "ok",
    providers: ["shinigami", "komiku", "kiryuu"],
    timestamp: new Date().toISOString(),
  }),
};

// ─── Komiku Provider (komiku.org) ───
const KOMIKU_BASE = "https://komiku.org";
const KOMIKU_API = "https://api.komiku.org";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function komikuParseListPage($: cheerio.CheerioAPI): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comics: any[] = [];
  $(".bge").each((_, el) => {
    const $el = $(el);
    const mangaLink = $el.find("a[href*='/manga/']").first();
    const href = mangaLink.attr("href") || "";
    const slug = href.replace(/https?:\/\/komiku\.org\/manga\//, "").replace(/^\/manga\//, "").replace(/\/$/, "");
    if (!slug) return;
    const title = $el.find(".kan h3").text().trim() || $el.find("h3").text().trim();
    const img = $el.find(".bgei img");
    const thumbnail = img.attr("src") || img.attr("data-src") || "";
    const typeText = $el.find(".tpe1_inf b").text().trim();
    const type = typeText.match(/^(Manga|Manhwa|Manhua)/i)?.[1] || "Manga";
    const genreText = $el.find(".tpe1_inf").text().replace(typeText, "").trim();
    const description = $el.find(".kan p").text().trim();
    const chapterLinks = $el.find(".new1 a");
    const latestCh = chapterLinks.last().find("span").last().text().trim();
    if (title) {
      comics.push({
        title, thumbnail, image: thumbnail,
        href: `/manga/${slug}`, type, description,
        genre: genreText || undefined,
        chapter: latestCh || undefined,
      });
    }
  });
  return comics;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const komikuHandlers: Record<string, (query: any, slug?: string) => Promise<any>> = {
  terbaru: async (query) => {
    const page = parseInt(query.page) || 1;
    const $ = await fetchHTML(`${KOMIKU_API}/manga/?orderby=modified&page=${page}`);
    return apiResponse(komikuParseListPage($));
  },

  popular: async () => {
    const $ = await fetchHTML(`${KOMIKU_API}/other/hot/`);
    return apiResponse(komikuParseListPage($));
  },

  recommended: async () => {
    const $ = await fetchHTML(`${KOMIKU_API}/manga/?orderby=meta_value_num`);
    return apiResponse(komikuParseListPage($).slice(0, 30));
  },

  search: async (query) => {
    const keyword = query.keyword;
    if (!keyword) return apiError("Parameter 'keyword' diperlukan", 400);
    const $ = await fetchHTML(`${KOMIKU_API}/?post_type=manga&s=${encodeURIComponent(keyword)}`);
    return apiResponse(komikuParseListPage($));
  },

  detail: async (_query, slug) => {
    if (!slug) return apiError("Slug required", 400);
    const $ = await fetchHTML(`${KOMIKU_BASE}/manga/${slug}/`);
    const title = $("h1").first().text().replace(/^Komik\s+/i, "").trim();
    const thumbnail = $(".ims img, .komik_info-content-thumbnail img, .thumb img").attr("src") || "";
    const description = $(".sinopsis p, .shortcsc p, #Sinopsis p").map((_, e) => $(e).text().trim()).get().join("\n") ||
      $(".entry-content p").first().text().trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const infoTable: Record<string, string> = {};
    $("table tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        infoTable[$(cells[0]).text().trim().toLowerCase()] = $(cells[1]).text().trim();
      }
    });
    const type = infoTable["jenis komik"] || "Manga";
    const author = infoTable["pengarang"] || "";
    const status = infoTable["status"] || "Unknown";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const genres: any[] = [];
    $("a[href*='/genre/']").each((_, el) => {
      const t = $(el).text().trim();
      const h = ($(el).attr("href") || "").replace(/https?:\/\/komiku\.org/, "").replace(/\/$/, "");
      if (t && h) genres.push({ title: t, href: h });
    });
    const uniqueGenres = [...new Map(genres.map(g => [g.href, g])).values()];
    // Extract all chapter links from the page (hrefs are relative like /slug-chapter-205-6/)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chapters: any[] = [];
    $("#daftarChapter a, a").each((_, el) => {
      const chHref = $(el).attr("href") || "";
      const match = chHref.match(/\/([a-z0-9][a-z0-9-]+-chapter-[\d]+(?:-\d+)?)\/??$/i);
      if (match) {
        const chSlug = match[1];
        // Convert hyphen-decimal to dot: chapter-205-6 → 205.6
        const numMatch = chSlug.match(/-chapter-(\d+)(?:-(\d+))?$/);
        const chNum = numMatch ? parseFloat(`${numMatch[1]}${numMatch[2] ? "." + numMatch[2] : ""}`) : undefined;
        const text = $(el).text().trim();
        chapters.push({
          title: text.includes("Chapter") ? text : `Chapter ${chNum || ""}`,
          href: `/chapter/${chSlug}`,
          number: chNum,
        });
      }
    });
    const uniqueChapters = [...new Map(chapters.map(c => [c.href, c])).values()]
      .sort((a, b) => (b.number || 0) - (a.number || 0));
    // Override status with AniList (authoritative)
    const aniStatus = await fetchAniListStatus(title);
    const finalStatus = aniStatus !== "Unknown" ? aniStatus : (status === "End" || status === "Tamat" ? "Completed" : status);
    // Cross-provider chapter merge: fill missing early chapters from other providers
    const altTitles = infoTable["judul indonesia"] || infoTable["nama lain"] || "";
    const mergedChapters = await mergeChaptersFromOtherProviders(uniqueChapters, title, "komiku", altTitles);
    return apiResponse({
      title, thumbnail, image: thumbnail, description, type, status: finalStatus, author,
      genre: uniqueGenres, chapters: mergedChapters,
      alternative: infoTable["judul indonesia"] || "",
      released: infoTable["released"] || "",
    });
  },

  read: async (_query, slug) => {
    if (!slug) return apiError("Slug required", 400);
    const $ = await fetchHTML(`${KOMIKU_BASE}/${slug}/`);
    const images: string[] = [];
    $("#Baca_Komik img, .chapter_body img, .entry-content.entry-content-single img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (src && !src.includes("icon") && !src.includes("logo") && !src.includes("avatar") && src.includes("komiku")) {
        images.push(src);
      }
    });
    const title = $("h1").first().text().trim();
    const prevHref = $("a[rel='prev']").attr("href") || "";
    const nextHref = $("a[rel='next']").attr("href") || "";
    const toSlug = (u: string) => u ? u.replace(/https?:\/\/komiku\.org\//, "").replace(/\/$/, "") || undefined : undefined;
    return apiResponse([{ title, panel: images, prev_chapter_id: toSlug(prevHref), next_chapter_id: toSlug(nextHref) }]);
  },

  genre: async (query, slug) => {
    if (slug) {
      const page = parseInt(query.page) || 1;
      const $ = await fetchHTML(`${KOMIKU_API}/genre/${slug}/?page=${page}`);
      return apiResponse(komikuParseListPage($));
    }
    const knownGenres = [
      "action","adventure","comedy","cooking","demons","drama","ecchi","fantasy",
      "game","gore","harem","historical","horror","isekai","josei","magic",
      "martial-arts","mature","mecha","military","monster-girls","music","mystery",
      "one-shot","psychological","romance","school","school-life","sci-fi","seinen",
      "shoujo","shoujo-ai","shounen","shounen-ai","slice-of-life","sports",
      "super-power","supernatural","thriller","tragedy","vampire","webtoon",
    ];
    return apiResponse(knownGenres.map(g => ({
      title: g.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      href: `/genre/${g}`,
    })));
  },

  health: async () => ({ status: "ok", provider: "komiku", timestamp: new Date().toISOString() }),
};

// ─── Kiryuu Provider (v3.kiryuu.to) ───
const KIRYUU_BASE = "https://v3.kiryuu.to";

// Fetch HTML for Kiryuu POST (admin-ajax search)
async function fetchHTMLPost(url: string, postBody: string): Promise<cheerio.CheerioAPI> {
  const { statusCode, body: resBody } = await request(url, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded",
      "HX-Request": "true",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
    },
    body: postBody,
  });
  const html = await resBody.text();
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode} from ${url}`);
  return cheerio.load(html);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function kiryuuParseListPage($: cheerio.CheerioAPI): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comics: any[] = [];
  // New structure: #search-results > div children, each with h1 title, .wp-post-image, .numscore, .link-self
  $("#search-results > div").each((_, el) => {
    const $el = $(el);
    const titleEl = $el.find("h1").first();
    const title = titleEl.text().trim();
    if (!title) return;
    const link = $el.find("a[href*='/manga/']").first();
    const href = link.attr("href") || "";
    const slug = href.replace(/https?:\/\/v[0-9]+\.kiryuu\.to\/manga\//, "").replace(/\/$/, "");
    if (!slug || slug.includes("?")) return;
    const img = $el.find(".wp-post-image").first();
    const thumbnail = img.attr("src") || img.attr("data-src") || "";
    const typeImg = $el.find("img[alt]").filter((_, e) => /^(manga|manhwa|manhua)$/i.test($(e).attr("alt") || "")).first();
    const typeFromImg = typeImg.attr("alt") || "";
    const type = typeFromImg ? typeFromImg.replace(/^./, (c) => c.toUpperCase()) : undefined;
    const rating = $el.find(".numscore").first().text().trim();
    // Status is in a <p> element near the status dot
    const statusText = $el.find("p").filter((_, e) => /^(Ongoing|Completed|Hiatus)$/i.test($(e).text().trim())).first().text().trim();
    // Chapter from .link-self
    const chapterEl = $el.find("a.link-self p.inline-block, a[class*='link-self'] p.inline-block").first();
    const chapter = chapterEl.text().trim();
    comics.push({
      title, thumbnail, image: thumbnail,
      href: `/manga/${slug}`, type,
      rating: rating || undefined,
      chapter: chapter || undefined,
      status: statusText || undefined,
      _slug: slug,
    });
  });
  return comics;
}

// Resolve/verify types for ALL Kiryuu comics using WP REST API batch query
async function kiryuuResolveTypes(comics: any[]): Promise<any[]> {
  const slugs = comics.map(c => c._slug).filter(Boolean);
  if (slugs.length === 0) {
    for (const c of comics) { delete c._slug; if (!c.type) c.type = "Manga"; }
    return comics;
  }
  try {
    // Batch query all slugs via WP REST API for authoritative type data
    const batchSize = 30;
    const typeMap: Record<string, string> = {};
    for (let i = 0; i < slugs.length; i += batchSize) {
      const batch = slugs.slice(i, i + batchSize);
      const url = `${KIRYUU_BASE}/wp-json/wp/v2/manga?slug=${batch.join(",")}&_embed=wp:term&per_page=${batch.length}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (res.ok) {
        const data = await res.json();
        for (const item of data) {
          const s = item.slug;
          const terms = item._embedded?.["wp:term"] || [];
          for (const group of terms) {
            for (const term of group) {
              if (term.taxonomy === "type" && term.name && term.name !== "-") {
                typeMap[s] = term.name;
              }
            }
          }
        }
      }
    }
    // Apply authoritative WP API types to ALL comics (overwrite HTML-detected types)
    for (const c of comics) {
      if (c._slug && typeMap[c._slug]) {
        c.type = typeMap[c._slug];
      }
    }
  } catch { /* fallback to existing types */ }
  // Clean up internal slug field and default missing types to "Manga"
  for (const c of comics) {
    delete c._slug;
    if (!c.type) c.type = "Manga";
  }
  return comics;
}

// Helper to fetch manga list via WP REST API (bypasses Cloudflare HTML blocking)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function kiryuuFetchWpMangaList(params: string): Promise<{ comics: any[]; totalPages: number }> {
  const url = `${KIRYUU_BASE}/wp-json/wp/v2/manga?${params}&_embed=wp:term,wp:featuredmedia`;
  const res = await fetch(url, {
    headers: { "User-Agent": DEFAULT_HEADERS["User-Agent"] },
  });
  if (!res.ok) throw new Error(`WP API error ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = await res.json();
  const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comics = data.map((m: any) => {
    const thumb = m._embedded?.["wp:featuredmedia"]?.[0]?.source_url || "";
    let type = "Manga";
    const terms = m._embedded?.["wp:term"] || [];
    for (const group of terms) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const term of (group as any[])) {
        if (term.taxonomy === "type" && term.name && term.name !== "-") type = term.name;
      }
    }
    return {
      title: m.title?.rendered || "",
      thumbnail: thumb, image: thumb,
      href: `/manga/${m.slug}`,
      type,
    };
  });
  return { comics, totalPages };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kiryuuHandlers: Record<string, (query: any, slug?: string) => Promise<any>> = {
  terbaru: async (query) => {
    const page = parseInt(query.page) || 1;
    const { comics, totalPages } = await kiryuuFetchWpMangaList(`per_page=30&page=${page}&orderby=modified&order=desc`);
    return apiResponse(comics, { current_page: page, length_page: totalPages, has_next: page < totalPages, has_prev: page > 1 });
  },

  popular: async () => {
    const { comics } = await kiryuuFetchWpMangaList(`per_page=30&orderby=modified&order=desc`);
    return apiResponse(comics);
  },

  recommended: async () => {
    const { comics } = await kiryuuFetchWpMangaList(`per_page=30&orderby=date&order=desc`);
    return apiResponse(comics);
  },

  search: async (query) => {
    const keyword = query.keyword;
    if (!keyword) return apiError("Parameter 'keyword' diperlukan", 400);
    const { comics } = await kiryuuFetchWpMangaList(`search=${encodeURIComponent(keyword)}&per_page=20&orderby=relevance`);
    return apiResponse(comics);
  },

  detail: async (_query, slug) => {
    if (!slug) return apiError("Slug required", 400);
    // Fetch full manga data from WP REST API (bypasses Cloudflare HTML blocking)
    const wpRes = await fetch(`${KIRYUU_BASE}/wp-json/wp/v2/manga?slug=${encodeURIComponent(slug)}&_embed=wp:term,wp:featuredmedia`, {
      headers: { "User-Agent": DEFAULT_HEADERS["User-Agent"] },
    });
    if (!wpRes.ok) throw new Error(`WP API error ${wpRes.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wpData: any[] = await wpRes.json();
    if (!wpData.length) return apiError("Comic not found", 404);
    const manga = wpData[0];
    const title = (manga.title?.rendered || "").replace(/&#8211;/g, "–").replace(/&#8217;/g, "'").replace(/&amp;/g, "&");
    const thumbnail = manga._embedded?.["wp:featuredmedia"]?.[0]?.source_url || "";
    // Description from excerpt or content
    const rawDesc = manga.excerpt?.rendered || manga.content?.rendered || "";
    const description = cheerio.load(rawDesc).text().trim();
    // Extract type, status, genres from embedded terms
    let type = "Manga", status = "Unknown";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const genres: any[] = [];
    const terms = manga._embedded?.["wp:term"] || [];
    for (const group of terms) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const term of (group as any[])) {
        if (term.taxonomy === "type" && term.name && term.name !== "-") type = term.name;
        if (term.taxonomy === "status") status = term.name || "Unknown";
        if (term.taxonomy === "genre") {
          genres.push({ title: term.name, href: `/genre/${term.slug}` });
        }
      }
    }
    // Fetch chapters via admin-ajax using WP post ID (native fetch, may bypass Cloudflare)
    const mangaId = manga.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chapters: any[] = [];
    try {
      const chRes = await fetch(`${KIRYUU_BASE}/wp-admin/admin-ajax.php?manga_id=${mangaId}&page=1&action=chapter_list`, {
        headers: { "User-Agent": DEFAULT_HEADERS["User-Agent"] },
      });
      if (chRes.ok) {
        const chHtml = await chRes.text();
        const ch$ = cheerio.load(chHtml);
        ch$("div[data-chapter-number]").each((_, el) => {
          const $ch = ch$(el);
          const chNum = $ch.attr("data-chapter-number") || "";
          const chLink = $ch.find("a").first();
          const chHref = chLink.attr("href") || "";
          const chTitle = $ch.find("span").first().text().trim() || `Chapter ${chNum}`;
          const chDate = $ch.find("time").attr("datetime") || "";
          if (!chHref) return;
          const path = chHref.replace(/https?:\/\/v[0-9]+\.kiryuu\.to\/manga\//, "").replace(/\/$/, "");
          const parts = path.split("/");
          if (parts.length < 2) return;
          const encoded = `${parts[0]}--${parts.slice(1).join("/")}`;
          chapters.push({
            title: chTitle, href: `/chapter/${encoded}`,
            date: chDate || undefined,
            number: chNum ? parseFloat(chNum) : undefined,
          });
        });
      }
    } catch { /* chapters unavailable from admin-ajax */ }
    // Override status with AniList (authoritative)
    const aniStatus = await fetchAniListStatus(title);
    if (aniStatus !== "Unknown") status = aniStatus;
    // Cross-provider chapter merge: fill missing early chapters from other providers
    const mergedChapters = await mergeChaptersFromOtherProviders(chapters, title, "kiryuu");
    return apiResponse({
      title, thumbnail, image: thumbnail, description, type, status, author: "", artist: "",
      genre: genres, rating: undefined, chapters: mergedChapters, released: "",
    });
  },

  read: async (_query, slug) => {
    if (!slug) return apiError("Slug required", 400);
    const sepIdx = slug.indexOf("--");
    let url: string;
    if (sepIdx !== -1) {
      url = `${KIRYUU_BASE}/manga/${slug.substring(0, sepIdx)}/${slug.substring(sepIdx + 2)}/`;
    } else {
      url = `${KIRYUU_BASE}/manga/${slug}/`;
    }
    const $ = await fetchHTML(url);
    const images: string[] = [];
    // New structure: section[data-image-data] img or fallback #readerarea img
    $("section[data-image-data] img, #readerarea img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (src && !src.includes("icon") && !src.includes("logo") && !src.includes("svg") && !src.includes("avatar")) {
        images.push(src.trim());
      }
    });
    // If still empty, try any img with cdnkuma domain
    if (images.length === 0) {
      $("img[src*='cdnkuma']").each((_, el) => {
        const src = $(el).attr("src") || "";
        if (src) images.push(src.trim());
      });
    }
    const title = $("h1").first().text().trim() || $("title").text().replace(/ - Kiryuu.*/i, "").trim();
    // Nav links: look for prev/next with rel or data attributes
    const prevHref = $("a[rel='prev']").attr("href") || $("a[data-prev]").attr("href") ||
      $("a:contains('Prev')").attr("href") || "";
    const nextHref = $("a[rel='next']").attr("href") || $("a[data-next]").attr("href") ||
      $("a:contains('Next')").attr("href") || "";
    const encodeNav = (href: string): string | undefined => {
      if (!href) return undefined;
      const p = href.replace(/https?:\/\/v[0-9]+\.kiryuu\.to\/manga\//, "").replace(/\/$/, "");
      const ps = p.split("/");
      return ps.length >= 2 ? `${ps[0]}--${ps.slice(1).join("/")}` : undefined;
    };
    return apiResponse([{ title, panel: images, prev_chapter_id: encodeNav(prevHref), next_chapter_id: encodeNav(nextHref) }]);
  },

  genre: async (query, slug) => {
    if (slug) {
      const page = parseInt(query.page) || 1;
      // Use WP REST API to find genre term ID by slug, then fetch manga
      try {
        const genreRes = await fetch(`${KIRYUU_BASE}/wp-json/wp/v2/genre?slug=${encodeURIComponent(slug)}&_fields=id`, {
          headers: { "User-Agent": DEFAULT_HEADERS["User-Agent"] },
        });
        if (!genreRes.ok) throw new Error("Genre not found");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const genreData: any[] = await genreRes.json();
        if (!genreData.length) throw new Error("Genre not found");
        const genreId = genreData[0].id;
        const mangaRes = await fetch(`${KIRYUU_BASE}/wp-json/wp/v2/manga?genre=${genreId}&per_page=20&page=${page}&_embed=wp:term,wp:featuredmedia`, {
          headers: { "User-Agent": DEFAULT_HEADERS["User-Agent"] },
        });
        if (!mangaRes.ok) throw new Error("Failed to fetch manga");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mangaData: any[] = await mangaRes.json();
        const totalPages = parseInt(mangaRes.headers.get("x-wp-totalpages") || "1");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const comics = mangaData.map((m: any) => {
          const thumb = m._embedded?.["wp:featuredmedia"]?.[0]?.source_url || "";
          let type = "Manga";
          const terms = m._embedded?.["wp:term"] || [];
          for (const group of terms) {
            for (const term of group) {
              if (term.taxonomy === "type" && term.name && term.name !== "-") type = term.name;
            }
          }
          return {
            title: m.title?.rendered || "",
            thumbnail: thumb, image: thumb,
            href: `/manga/${m.slug}`,
            type,
          };
        });
        return apiResponse(comics, { current_page: page, length_page: totalPages, has_next: page < totalPages, has_prev: page > 1 });
      } catch {
        // Fallback to HTML scraping
        const $ = await fetchHTML(`${KIRYUU_BASE}/genre/${slug}/page/${page}/`);
        const comics = kiryuuParseListPage($);
        if (comics.length > 0) return apiResponse(comics);
        return apiResponse([]);
      }
    }
    // Genre list — use WP REST API
    try {
      const res = await fetch(`${KIRYUU_BASE}/wp-json/wp/v2/genre?per_page=100&_fields=slug,name,count&orderby=count&order=desc`, {
        headers: { "User-Agent": DEFAULT_HEADERS["User-Agent"] },
      });
      if (!res.ok) throw new Error("Failed");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any[] = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const genres = data.filter((g: any) => g.count > 0).map((g: any) => ({
        title: g.name, href: `/genre/${g.slug}`,
      }));
      if (genres.length > 0) return apiResponse(genres);
    } catch { /* fallback */ }
    const fallback = ["action","adventure","comedy","drama","fantasy","harem","horror","isekai",
      "martial-arts","mystery","psychological","romance","school-life","sci-fi","seinen",
      "shoujo","shounen","slice-of-life","sports","supernatural","thriller","tragedy"];
    return apiResponse(fallback.map(g => ({
      title: g.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      href: `/genre/${g}`,
    })));
  },

  health: async () => ({ status: "ok", provider: "kiryuu", timestamp: new Date().toISOString() }),
};

// ─── Cross-Provider Chapter Merge ───
// If a provider has incomplete chapters (e.g., starts at ch.100), try other providers to fill gaps
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mergeChaptersFromOtherProviders(
  primaryChapters: any[],
  comicTitle: string,
  currentProvider: string,
  alternativeTitles?: string
): Promise<any[]> {
  if (!comicTitle || primaryChapters.length === 0) return primaryChapters;

  // Tag primary chapters with their provider
  primaryChapters.forEach(ch => { if (!ch.provider) ch.provider = currentProvider; });

  const numbers = primaryChapters.map(c => c.number).filter((n: number) => typeof n === "number" && !isNaN(n));
  if (numbers.length === 0) return primaryChapters;

  // Build list of titles to try: primary title + alternative titles
  const titlesToTry = [comicTitle];
  if (alternativeTitles) {
    const alts = alternativeTitles.split(",").map(s => s.trim()).filter(s => s && !/[\u4e00-\u9fff\u3400-\u4dbf]/.test(s));
    for (const alt of alts) {
      if (!titlesToTry.some(t => t.toLowerCase() === alt.toLowerCase())) {
        titlesToTry.push(alt);
      }
    }
  }

  // Always try to merge from other providers to get the most complete chapter list
  const otherProviders = ["shinigami", "komiku", "kiryuu"].filter(p => p !== currentProvider);
  const existingNumbers = new Set(numbers);

  for (const fallbackProvider of otherProviders) {
    try {
      let fallbackChapters: any[] = [];

      // Try each title until we find chapters
      for (const searchTitle of titlesToTry) {
        if (fallbackProvider === "komiku") {
          fallbackChapters = await fetchKomikuChaptersForMerge(searchTitle);
        } else if (fallbackProvider === "kiryuu") {
          fallbackChapters = await fetchKiryuuChaptersForMerge(searchTitle);
        } else if (fallbackProvider === "shinigami") {
          fallbackChapters = await fetchShinigamiChaptersForMerge(searchTitle);
        }
        if (fallbackChapters.length > 0) break;
      }

      if (fallbackChapters.length === 0) continue;

      // If fallback provider has WAY more chapters, use it as the base
      // e.g., primary has 4 chapters, fallback has 200 → swap base
      if (fallbackChapters.length > primaryChapters.length * 3 && fallbackChapters.length > 20) {
        // Fallback has significantly more chapters — use it as base
        const fallbackNumbers = new Set(
          fallbackChapters.map(c => c.number).filter((n: number) => typeof n === "number" && !isNaN(n))
        );
        // Add primary chapters that fallback doesn't have
        for (const pch of primaryChapters) {
          if (typeof pch.number === "number" && !isNaN(pch.number) && !fallbackNumbers.has(pch.number)) {
            fallbackChapters.push(pch);
            fallbackNumbers.add(pch.number);
          }
        }
        primaryChapters = fallbackChapters;
        // Update existing numbers set
        existingNumbers.clear();
        for (const ch of primaryChapters) {
          if (typeof ch.number === "number" && !isNaN(ch.number)) existingNumbers.add(ch.number);
        }
      } else {
        // Normal merge: add chapters from fallback that don't exist in primary
        for (const fch of fallbackChapters) {
          if (typeof fch.number === "number" && !isNaN(fch.number) && !existingNumbers.has(fch.number)) {
            primaryChapters.push(fch);
            existingNumbers.add(fch.number);
          }
        }
      }
    } catch {
      continue;
    }
  }

  // Re-sort desc by chapter number
  primaryChapters.sort((a: any, b: any) => (b.number || 0) - (a.number || 0));
  return primaryChapters;
}

// Fetch chapters from Komiku for merge
async function fetchKomikuChaptersForMerge(comicTitle: string): Promise<any[]> {
  const $ = await fetchHTML(`${KOMIKU_API}/?post_type=manga&s=${encodeURIComponent(comicTitle)}`);
  const results = komikuParseListPage($);
  if (!results.length) return [];
  const match = findBestTitleMatch(results, comicTitle);
  if (!match) return [];
  const slug = match.href.replace(/^\/manga\//, "").replace(/\/$/, "");
  
  const detail$ = await fetchHTML(`${KOMIKU_BASE}/manga/${slug}/`);
  const chapters: any[] = [];
  
  // Use same selectors as the Komiku detail handler
  detail$("#daftarChapter a, a").each((_, el) => {
    const chHref = detail$(el).attr("href") || "";
    const chMatch = chHref.match(/\/([a-z0-9][a-z0-9-]+-chapter-[\d]+(?:-\d+)?)\/??$/i);
    if (chMatch) {
      const chSlug = chMatch[1];
      const numMatch = chSlug.match(/-chapter-(\d+)(?:-(\d+))?$/);
      const chNum = numMatch ? parseFloat(`${numMatch[1]}${numMatch[2] ? "." + numMatch[2] : ""}`) : undefined;
      if (typeof chNum !== "number" || isNaN(chNum)) return;
      const text = detail$(el).text().trim();
      chapters.push({
        title: text.includes("Chapter") ? text : `Chapter ${chNum}`,
        href: `/chapter/${chSlug}`,
        number: chNum,
        provider: "komiku",
      });
    }
  });
  
  return [...new Map(chapters.map(c => [c.href, c])).values()];
}

// Fetch chapters from Kiryuu for merge
async function fetchKiryuuChaptersForMerge(comicTitle: string): Promise<any[]> {
  const searchRes = await fetch(
    `${KIRYUU_BASE}/wp-json/wp/v2/manga?search=${encodeURIComponent(comicTitle)}&per_page=5&_fields=slug,title`,
    { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }
  );
  if (!searchRes.ok) return [];
  const searchData: any[] = await searchRes.json();
  if (!searchData.length) return [];
  const match = findBestTitleMatch(
    searchData.map(d => ({ title: d.title?.rendered || d.title || "", href: d.slug })),
    comicTitle
  );
  if (!match) return [];
  
  const detail$ = await fetchHTML(`${KIRYUU_BASE}/manga/${match.href}/`);
  const mangaIdMatch = detail$.html().match(/manga_id=(\d+)/);
  if (!mangaIdMatch) return [];
  
  const ch$ = await fetchHTML(`${KIRYUU_BASE}/wp-admin/admin-ajax.php?manga_id=${mangaIdMatch[1]}&page=1&action=chapter_list`).catch(() => null);
  if (!ch$) return [];
  
  const chapters: any[] = [];
  ch$("div[data-chapter-number]").each((_, el) => {
    const $ch = ch$(el);
    const chNum = $ch.attr("data-chapter-number") || "";
    const chLink = $ch.find("a").first();
    const chHref = chLink.attr("href") || "";
    const chTitle = $ch.find("span").first().text().trim() || `Chapter ${chNum}`;
    const chDate = $ch.find("time").attr("datetime") || "";
    if (!chHref || !chNum) return;
    const num = parseFloat(chNum);
    if (isNaN(num)) return;
    const path = chHref.replace(/https?:\/\/v[0-9]+\.kiryuu\.to\/manga\//, "").replace(/\/$/, "");
    const parts = path.split("/");
    if (parts.length < 2) return;
    const encoded = `${parts[0]}--${parts.slice(1).join("/")}`;
    chapters.push({
      title: chTitle,
      href: `/chapter/${encoded}`,
      date: chDate || undefined,
      number: num,
      provider: "kiryuu",
    });
  });
  
  return chapters;
}

// Fetch chapters from Shinigami for merge
async function fetchShinigamiChaptersForMerge(comicTitle: string): Promise<any[]> {
  const result: any = await getMangaList({ page: 1, page_size: 10, sort: "latest", sort_order: "desc", q: comicTitle });
  if (result.retcode !== 0 || !result.data?.length) return [];
  const match = findBestTitleMatch(
    result.data.map((d: any) => ({ title: d.title || "", href: d.manga_id || "" })),
    comicTitle
  );
  if (!match) return [];
  const chResult: any = await getChapterList(match.href);
  if (chResult.retcode !== 0 || !chResult.data?.length) return [];
  return transformChapters(chResult.data).map((ch: any) => ({ ...ch, provider: "shinigami" }));
}

// Find best title match from search results using normalized comparison
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findBestTitleMatch(results: any[], targetTitle: string): any | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = normalize(targetTitle);
  if (!target) return results[0] || null;

  // Score each result
  const scored = results.map(r => {
    const rawTitle = typeof r.title === "object" ? (r.title.rendered || "") : (r.title || "");
    const n = normalize(rawTitle);
    let score = 0;
    if (n === target) score = 100; // exact
    else if (n.includes(target) || target.includes(n)) score = 80; // contains
    else {
      // Word overlap score
      const targetWords: string[] = target.match(/[a-z0-9]+/g) || [];
      const titleWords: string[] = n.match(/[a-z0-9]+/g) || [];
      const matchedWords = targetWords.filter(w => titleWords.includes(w));
      score = (matchedWords.length / Math.max(targetWords.length, 1)) * 60;
    }
    return { result: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  // Return best match if score is reasonable (> 40%)
  return scored.length > 0 && scored[0].score > 40 ? scored[0].result : null;
}

// ─── Provider Routing ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers: Record<string, Record<string, (query: any, slug?: string) => Promise<any>>> = {
  shinigami: shinigamiHandlers,
  komiku: komikuHandlers,
  kiryuu: kiryuuHandlers,
};

// ─── Analytics Tracking (fire-and-forget) ───
let _analyticsQuery: any;
let _analyticsMigrated = false;

async function getAnalyticsDb() {
  if (!_analyticsQuery) {
    const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_PRISMA_URL || "";
    if (!url) return null;
    const neonMod = await import("@neondatabase/serverless");
    const neon = (neonMod as any).neon || (neonMod as any).default?.neon;
    const sql = neon(url);
    _analyticsQuery = (text: string, params: unknown[] = []) => sql.query(text, params);
  }
  if (!_analyticsMigrated) {
    try {
      await _analyticsQuery(`
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
      await _analyticsQuery("CREATE INDEX IF NOT EXISTS idx_analytics_created ON api_analytics(created_at DESC)");
      await _analyticsQuery("CREATE INDEX IF NOT EXISTS idx_analytics_ip ON api_analytics(ip_hash)");
    } catch { /* ignore */ }
    _analyticsMigrated = true;
  }
  return _analyticsQuery;
}

function hashIP(ip: string): string {
  return crypto.createHash("sha256").update(ip + (process.env.API_SECRET || "salt")).digest("hex").slice(0, 16);
}

function trackRequest(req: VercelRequest, endpoint: string, provider: string) {
  // Fire-and-forget: don't await, don't block response
  getAnalyticsDb().then(q => {
    if (!q) return;
    const ip = getRateLimitKey(req);
    const ipHash = hashIP(ip);
    const ua = (typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "").slice(0, 500);
    const referer = (typeof req.headers.referer === "string" ? req.headers.referer : "").slice(0, 500);
    const country = (typeof req.headers["x-vercel-ip-country"] === "string" ? req.headers["x-vercel-ip-country"] : "").slice(0, 10);
    q("INSERT INTO api_analytics (ip_hash, endpoint, provider, user_agent, referer, country) VALUES ($1,$2,$3,$4,$5,$6)",
      [ipHash, endpoint.slice(0, 255), provider.slice(0, 50), ua, referer, country]
    ).catch(() => {});
  }).catch(() => {});
}

// ─── Main handler ───
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // CORS — only allow specific origins
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (ALLOWED_ORIGINS.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Api-Token, X-Api-Timestamp");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json(apiError("Method not allowed", 405));
  }

  // Rate limiting
  const clientKey = getRateLimitKey(req);
  if (isRateLimited(clientKey)) {
    return res.status(429).json(apiError("Too many requests. Please wait.", 429));
  }

  // Parse path early to check if health endpoint (skip auth for health/dashboard)
  const urlPath = (req.url || "/").split("?")[0].replace(/^\/api\/?/, "");
  const routeName = urlPath.split("/").filter(Boolean)[0] || "health";

  try {
    // Parse path
    const url = req.url || "/";
    const pathParts = url.split("?")[0].replace(/^\/api\/?/, "").split("/").filter(Boolean);
    const route = pathParts[0] || "health";
    const rawSlug = pathParts[1] || undefined;

    // Validate route name
    if (!/^[a-z]+$/.test(route)) {
      return res.status(400).json(apiError("Invalid route", 400));
    }

    // Sanitize slug
    const slug = rawSlug ? sanitizeSlug(rawSlug) : undefined;
    if (rawSlug && !slug) {
      return res.status(400).json(apiError("Invalid parameter", 400));
    }

    // Validate query params (skip 'path' — Vercel rewrite artifact, not user input)
    for (const [key, val] of Object.entries(req.query)) {
      if (key === "path") continue;
      const v = Array.isArray(val) ? val[0] : val;
      if (typeof v === "string" && !isSafeInput(v)) {
        return res.status(400).json(apiError("Invalid input detected", 400));
      }
    }

    // Provider routing
    const provider = (typeof req.query.provider === "string" ? req.query.provider : "shinigami").toLowerCase();
    const providerHandlers = route === "health" ? shinigamiHandlers : providers[provider];
    if (!providerHandlers) {
      return res.status(400).json(apiError(`Unknown provider: ${provider}`, 400));
    }
    const handlerFn = providerHandlers[route];
    if (!handlerFn) {
      return res.status(404).json(apiError("Endpoint not found", 404));
    }

    const result = await handlerFn(req.query, slug);
    const statusCode = result.code && result.status === "error" ? result.code : 200;

    // Track request (fire-and-forget, non-blocking)
    trackRequest(req, `/${route}${slug ? "/" + slug : ""}`, provider);

    // Route-specific cache control to minimize edge requests
    const cacheMap: Record<string, string> = {
      genre:       "public, s-maxage=600, stale-while-revalidate=1800",  // 10 min + 30 min stale
      recommended: "public, s-maxage=300, stale-while-revalidate=600",   // 5 min + 10 min stale
      popular:     "public, s-maxage=300, stale-while-revalidate=600",   // 5 min + 10 min stale
      detail:      "public, s-maxage=300, stale-while-revalidate=900",   // 5 min + 15 min stale
      terbaru:     "public, s-maxage=120, stale-while-revalidate=300",   // 2 min + 5 min stale
      search:      "public, s-maxage=120, stale-while-revalidate=300",   // 2 min + 5 min stale
      read:        "public, s-maxage=600, stale-while-revalidate=3600",  // 10 min + 1 hr stale (panels rarely change)
      health:      "no-cache",
    };
    res.setHeader("Cache-Control", cacheMap[route] || "public, s-maxage=120, stale-while-revalidate=300");

    return res.status(statusCode).json(result);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("API Error:", errMsg, error);
    return res.status(500).json(apiError("Internal server error"));
  }
}
