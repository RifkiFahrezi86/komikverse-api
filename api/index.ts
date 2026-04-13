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
    providers: ["shinigami", "komiku", "komikapk"],
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

// ─── KomikAPK Provider (komikapk.app) ───
const KOMIKAPK_BASE = "https://komikapk.app";
const KOMIKAPK_IMG_CDN = "https://s1.cdn-guard.com/komikapk2-chapter/";
const KOMIKAPK_DEFAULT_UPLOADER = "kmapk";

// Dereference SvelteKit __data.json compressed array-reference format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function derefSvelteData(raw: any): any {
  const nodes = raw?.nodes;
  if (!Array.isArray(nodes)) return null;
  // Find first non-null data node
  const node = nodes.find((n: any) => n?.type === "data" && n.data);
  if (!node) return null;
  const flat = node.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function deref(val: any): any {
    if (typeof val === "number" && Number.isInteger(val) && val >= 0 && val < flat.length) {
      const target = flat[val];
      if (target === val) return target; // self-reference = literal number
      return deref(target);
    }
    if (Array.isArray(val)) return val.map(deref);
    if (val && typeof val === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out: any = {};
      for (const [k, v] of Object.entries(val)) out[k] = deref(v);
      return out;
    }
    return val;
  }
  return deref(flat[0]);
}

function decodeHtml(s: string): string {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#8211;/g, "–").replace(/&#8217;/g, "\u2019")
    .replace(/&#8220;/g, "\u201C").replace(/&#8221;/g, "\u201D");
}

function komikapkTransformImageUrl(url: string): string {
  if (url.startsWith("https://storage.com/")) {
    return url.replace("https://storage.com/", KOMIKAPK_IMG_CDN);
  }
  return url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function komikapkFetchData(path: string): Promise<any> {
  const url = `${KOMIKAPK_BASE}${path}/__data.json`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`KomikAPK error ${res.status} for ${path}`);
  const raw = await res.json();
  return derefSvelteData(raw);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function komikapkMapComic(c: any): any {
  return {
    title: decodeHtml(c.title || ""),
    thumbnail: c.coverUrl || "",
    image: c.coverUrl || "",
    href: `/manga/${c.slug}`,
    type: c.origin ? c.origin.charAt(0).toUpperCase() + c.origin.slice(1) : "Manga",
    chapter: c.latestChapter?.name ? `Chapter ${c.latestChapter.name}` : undefined,
    description: c.sinopsis ? decodeHtml(c.sinopsis).substring(0, 200) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const komikapkHandlers: Record<string, (query: any, slug?: string) => Promise<any>> = {
  terbaru: async (query) => {
    const page = parseInt(query.page) || 1;
    const data = await komikapkFetchData(`/pustaka/semua/semua/terbaru/${page}`);
    const comicCards = data?.comicCards || data;
    const comics = (comicCards?.comics || []).map(komikapkMapComic);
    const currentPage = comicCards?.page || page;
    return apiResponse(comics, {
      current_page: currentPage,
      length_page: Math.max(currentPage + 1, 10),
      has_next: comics.length >= 20,
      has_prev: currentPage > 1,
    });
  },

  popular: async () => {
    const data = await komikapkFetchData("/trending");
    const comics = (data?.comics || []).slice(0, 30).map(komikapkMapComic);
    return apiResponse(comics);
  },

  recommended: async () => {
    const data = await komikapkFetchData("/pustaka/semua/semua/terbaru/1");
    const comicCards = data?.comicCards || data;
    const comics = (comicCards?.comics || []).slice(0, 30).map(komikapkMapComic);
    return apiResponse(comics);
  },

  search: async (query) => {
    const keyword = query.keyword;
    if (!keyword) return apiError("Parameter 'keyword' diperlukan", 400);
    const res = await fetch(`${KOMIKAPK_BASE}/pencarian/__data.json?q=${encodeURIComponent(keyword)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`Search error ${res.status}`);
    const raw = await res.json();
    const data = derefSvelteData(raw);
    const comics = (data?.comics || []).map(komikapkMapComic);
    return apiResponse(comics);
  },

  detail: async (_query, slug) => {
    if (!slug) return apiError("Slug required", 400);
    const data = await komikapkFetchData(`/komik/${slug}`);
    const comic = data?.comicDetail;
    if (!comic) return apiError("Comic not found", 404);
    const title = decodeHtml(comic.title || "");
    const thumbnail = comic.coverUrl || "";
    const description = comic.sinopsis ? decodeHtml(comic.sinopsis) : "";
    const type = comic.origin ? comic.origin.charAt(0).toUpperCase() + comic.origin.slice(1) : "Manga";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const genres = (comic.genres || []).map((g: any) => ({
      title: g.name || g.title || "",
      href: `/genre/${g.slug || ""}`,
    }));
    // Chapters: chaptersNonImage has all chapter metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chapters = (comic.chaptersNonImage || []).map((ch: any) => {
      const chName = ch.name || "";
      const num = parseFloat(chName);
      // Encode: slug--uploader--chapterName
      const encoded = `${slug}--${KOMIKAPK_DEFAULT_UPLOADER}--${chName}`;
      return {
        title: `Chapter ${chName}`,
        href: `/chapter/${encoded}`,
        date: ch.createdAt || undefined,
        number: isNaN(num) ? undefined : num,
      };
    });
    // Sort chapters descending by number
    chapters.sort((a: any, b: any) => (b.number || 0) - (a.number || 0));
    // Override status with AniList (authoritative)
    let status = "Unknown";
    const aniStatus = await fetchAniListStatus(title);
    if (aniStatus !== "Unknown") status = aniStatus;
    // Cross-provider chapter merge
    const mergedChapters = await mergeChaptersFromOtherProviders(chapters, title, "komikapk");
    return apiResponse({
      title, thumbnail, image: thumbnail, description, type, status, author: "", artist: "",
      genre: genres, rating: undefined, chapters: mergedChapters, released: "",
    });
  },

  read: async (_query, slug) => {
    if (!slug) return apiError("Slug required", 400);
    // Slug format: comicSlug--uploaderSlug--chapterName
    const parts = slug.split("--");
    let comicSlug: string, uploaderSlug: string, chapterName: string;
    if (parts.length >= 3) {
      comicSlug = parts[0];
      uploaderSlug = parts[1];
      chapterName = parts.slice(2).join("--");
    } else if (parts.length === 2) {
      comicSlug = parts[0];
      uploaderSlug = KOMIKAPK_DEFAULT_UPLOADER;
      chapterName = parts[1];
    } else {
      return apiError("Invalid chapter slug format", 400);
    }
    const data = await komikapkFetchData(`/komik/${comicSlug}/${uploaderSlug}/${chapterName}`);
    const chapter = data?.chapter;
    if (!chapter) return apiError("Chapter not found", 404);
    const title = decodeHtml(data?.comicDetail?.title || "") + ` Chapter ${chapter.name || chapterName}`;
    const images = (chapter.images || []).map(komikapkTransformImageUrl);
    // Find prev/next chapters from the comic detail's chapter list
    const allChapters = data?.comicDetail?.chaptersNonImage || [];
    const currentOrder = chapter.chapterOrder;
    let prevChapterId: string | undefined;
    let nextChapterId: string | undefined;
    if (typeof currentOrder === "number") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prev = allChapters.find((c: any) => c.chapterOrder === currentOrder - 1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const next = allChapters.find((c: any) => c.chapterOrder === currentOrder + 1);
      if (prev) prevChapterId = `${comicSlug}--${uploaderSlug}--${prev.name}`;
      if (next) nextChapterId = `${comicSlug}--${uploaderSlug}--${next.name}`;
    }
    return apiResponse([{ title, panel: images, prev_chapter_id: prevChapterId, next_chapter_id: nextChapterId }]);
  },

  genre: async (query, slug) => {
    if (slug) {
      const page = parseInt(query.page) || 1;
      const type = query.type || "semua";
      const data = await komikapkFetchData(`/pustaka/${type}/${slug}/terbaru/${page}`);
      const comicCards = data?.comicCards || data;
      const comics = (comicCards?.comics || []).map(komikapkMapComic);
      const currentPage = comicCards?.page || page;
      return apiResponse(comics, {
        current_page: currentPage,
        length_page: Math.max(currentPage + 1, 10),
        has_next: comics.length >= 20,
        has_prev: currentPage > 1,
      });
    }
    // Genre list — fetch from pustaka page which includes genres
    const data = await komikapkFetchData("/pustaka/semua/semua/terbaru/1");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const genres = (data?.genres || []).map((g: any) => ({
      title: g.name || g.title || "",
      href: `/genre/${g.slug || ""}`,
    }));
    if (genres.length > 0) return apiResponse(genres);
    const fallback = ["action","adventure","comedy","drama","fantasy","harem","horror","isekai",
      "martial-arts","mystery","psychological","romance","school-life","sci-fi","seinen",
      "shoujo","shounen","slice-of-life","sports","supernatural","thriller","tragedy"];
    return apiResponse(fallback.map(g => ({
      title: g.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      href: `/genre/${g}`,
    })));
  },

  health: async () => ({ status: "ok", provider: "komikapk", timestamp: new Date().toISOString() }),
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
  const otherProviders = ["shinigami", "komiku", "komikapk"].filter(p => p !== currentProvider);
  const existingNumbers = new Set(numbers);

  for (const fallbackProvider of otherProviders) {
    try {
      let fallbackChapters: any[] = [];

      // Try each title until we find chapters
      for (const searchTitle of titlesToTry) {
        if (fallbackProvider === "komiku") {
          fallbackChapters = await fetchKomikuChaptersForMerge(searchTitle);
        } else if (fallbackProvider === "komikapk") {
          fallbackChapters = await fetchKomikapkChaptersForMerge(searchTitle);
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

// Fetch chapters from KomikAPK for merge
async function fetchKomikapkChaptersForMerge(comicTitle: string): Promise<any[]> {
  try {
    const searchData = await komikapkFetchData(`/pencarian/__data.json?q=${encodeURIComponent(comicTitle)}`);
    if (!searchData?.nodes) return [];

    const results = searchData.nodes
      .filter((n: any) => n?.type === "data" && n?.data)
      .flatMap((n: any) => {
        const d = derefSvelteData(n.data);
        return Array.isArray(d) ? d : d?.results || d?.comics || [];
      })
      .filter((c: any) => c?.slug && c?.title);

    const match = findBestTitleMatch(
      results.map((c: any) => ({ title: c.title, href: c.slug })),
      comicTitle
    );
    if (!match) return [];

    const detailData = await komikapkFetchData(`/komik/${match.href}/__data.json`);
    if (!detailData?.nodes) return [];

    let chapters: any[] = [];
    for (const node of detailData.nodes) {
      if (node?.type !== "data" || !node?.data) continue;
      const d = derefSvelteData(node.data);
      const chList = d?.chapters || d?.comic?.chapters;
      if (!Array.isArray(chList)) continue;
      for (const ch of chList) {
        if (!ch?.slug) continue;
        const numMatch = ch.slug.match(/[\d.]+/);
        const num = numMatch ? parseFloat(numMatch[0]) : 0;
        chapters.push({
          title: ch.title || ch.name || `Chapter ${num}`,
          href: `/chapter/${match.href}--${KOMIKAPK_DEFAULT_UPLOADER}--${ch.slug}`,
          date: ch.created_at || ch.date || undefined,
          number: num,
          provider: "komikapk",
        });
      }
      break;
    }

    return chapters;
  } catch {
    return [];
  }
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
  komikapk: komikapkHandlers,
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
