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
      "User-Agent": DEFAULT_HEADERS["User-Agent"],
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
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
  return c === "KR" ? "Manhwa" : c === "CN" ? "Manhua" : "Manga";
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
    const resp = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { search: title } }),
    });
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
    type: m.taxonomy?.Format?.[0]?.name || getTypeFromCountry(m.country_id),
    chapter: m.latest_chapter_number ? `Chapter ${m.latest_chapter_number}` : undefined,
    rating: m.user_rate || undefined,
    description: m.description,
    genre: m.taxonomy?.Genre?.map((g: { name: string }) => g.name).join(", "),
    status: getStatusText(m.status),
    author: m.taxonomy?.Author?.map((a: { name: string }) => a.name).join(", "),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformComicDetail(m: any) {
  return {
    title: m.title,
    thumbnail: m.cover_image_url,
    image: m.cover_image_url,
    description: m.description,
    type: m.taxonomy?.Format?.[0]?.name || getTypeFromCountry(m.country_id),
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
    return apiResponse({
      title, thumbnail, image: thumbnail, description, type, status: finalStatus, author,
      genre: uniqueGenres, chapters: uniqueChapters,
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

// ─── Kiryuu Provider (v1.kiryuu.to) ───
const KIRYUU_BASE = "https://v1.kiryuu.to";

// Fetch HTML for Kiryuu POST (admin-ajax search)
async function fetchHTMLPost(url: string, body: string): Promise<cheerio.CheerioAPI> {
  const { statusCode, body: resBody } = await request(url, {
    method: "POST",
    headers: {
      "User-Agent": DEFAULT_HEADERS["User-Agent"],
      "Content-Type": "application/x-www-form-urlencoded",
      "HX-Request": "true",
      Accept: "text/html,application/xhtml+xml",
    },
    body,
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
    const slug = href.replace(/https?:\/\/v1\.kiryuu\.to\/manga\//, "").replace(/\/$/, "");
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

// Resolve missing types for Kiryuu comics using WP REST API batch query
async function kiryuuResolveTypes(comics: any[]): Promise<any[]> {
  const missing = comics.filter(c => !c.type);
  if (missing.length === 0) return comics;
  const slugs = missing.map(c => c._slug).filter(Boolean);
  if (slugs.length === 0) return comics;
  try {
    const url = `${KIRYUU_BASE}/wp-json/wp/v2/manga?slug=${slugs.join(",")}&_embed=wp:term&per_page=${slugs.length}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (res.ok) {
      const data = await res.json();
      const typeMap: Record<string, string> = {};
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
      for (const c of comics) {
        if (!c.type && c._slug && typeMap[c._slug]) {
          c.type = typeMap[c._slug];
        }
      }
    }
  } catch { /* fallback to existing types */ }
  // Clean up internal slug field
  for (const c of comics) {
    delete c._slug;
  }
  return comics;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kiryuuHandlers: Record<string, (query: any, slug?: string) => Promise<any>> = {
  terbaru: async (query) => {
    const page = parseInt(query.page) || 1;
    const $ = await fetchHTML(`${KIRYUU_BASE}/manga/?page=${page}&order=update`);
    const comics = await kiryuuResolveTypes(kiryuuParseListPage($));
    const lastPage = $(".pagination a, .hpage a").last().attr("href") || "";
    const pgMatch = lastPage.match(/page[=/](\d+)/);
    const totalPages = pgMatch ? parseInt(pgMatch[1]) : page;
    return apiResponse(comics, { current_page: page, length_page: totalPages, has_next: page < totalPages, has_prev: page > 1 });
  },

  popular: async () => {
    const $ = await fetchHTML(`${KIRYUU_BASE}/manga/?order=popular`);
    return apiResponse(await kiryuuResolveTypes(kiryuuParseListPage($)));
  },

  recommended: async () => {
    const $ = await fetchHTML(`${KIRYUU_BASE}/manga/?order=rating`);
    return apiResponse((await kiryuuResolveTypes(kiryuuParseListPage($))).slice(0, 30));
  },

  search: async (query) => {
    const keyword = query.keyword;
    if (!keyword) return apiError("Parameter 'keyword' diperlukan", 400);
    // Kiryuu now uses HTMX POST for search with nonce
    const page$ = await fetchHTML(`${KIRYUU_BASE}/`);
    const nonceMatch = page$.html().match(/nonce=([a-f0-9]+)/);
    if (!nonceMatch) throw new Error("Failed to extract Kiryuu nonce");
    const nonce = nonceMatch[1];
    const $ = await fetchHTMLPost(
      `${KIRYUU_BASE}/wp-admin/admin-ajax.php?nonce=${nonce}&action=search`,
      `query=${encodeURIComponent(keyword)}`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comics: any[] = [];
    $("#searchResults a[href*='/manga/'], a[href*='/manga/']").each((_, el) => {
      const $a = $(el);
      const href = $a.attr("href") || "";
      const slug = href.replace(/https?:\/\/v1\.kiryuu\.to\/manga\//, "").replace(/\/$/, "");
      if (!slug || slug.includes("?") || slug.includes("advanced")) return;
      const title = $a.find("h3").text().trim();
      const img = $a.find("img");
      const thumbnail = img.attr("src") || "";
      const description = $a.find("p").text().trim();
      if (title) {
        comics.push({
          title, thumbnail, image: thumbnail,
          href: `/manga/${slug}`,
          type: undefined,
          description: description || undefined,
          _slug: slug,
        });
      }
    });
    return apiResponse(await kiryuuResolveTypes(comics));
  },

  detail: async (_query, slug) => {
    if (!slug) return apiError("Slug required", 400);
    const $ = await fetchHTML(`${KIRYUU_BASE}/manga/${slug}/`);
    // Title from og:title or <title>
    const title = $("meta[property='og:title']").attr("content")?.trim() ||
      $("title").text().replace(/ Bahasa Indonesia.*| - Kiryuu.*/i, "").trim() || "";
    const thumbnail = $("meta[property='og:image']").attr("content") || $(".wp-post-image").first().attr("src") || "";
    const description = $("div[itemprop='description']").text().trim() ||
      $("meta[name='description']").attr("content")?.trim() || "";
    // Type and info from detail section
    const infoItems = $("h4 span.font-semibold");
    let type = "Manga", status = "Unknown", author = "", artist = "", released = "";
    infoItems.each((_, el) => {
      const label = $(el).text().trim().toLowerCase();
      const value = $(el).closest("div").find("p").text().trim();
      if (label === "type") type = type === "Manga" ? (value || "Manga") : type;
      if (label === "status") status = value || "Unknown";
      if (label.includes("author")) author = value || "";
      if (label.includes("artist")) artist = value || "";
      if (label.includes("released") || label.includes("year")) released = value || "";
    });
    // Genres from itemprop="genre"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const genres: any[] = [];
    $("a[itemprop='genre']").each((_, el) => {
      const t = $(el).find("span").text().trim() || $(el).text().trim();
      const h = ($(el).attr("href") || "").replace(/https?:\/\/v1\.kiryuu\.to/, "").replace(/\/$/, "");
      if (t && h) genres.push({ title: t, href: h });
    });
    // Rating from schema
    const rating = $("div[itemprop='ratingValue']").attr("content") ||
      $(".numscore").first().text().trim();
    // Fetch chapters and status in parallel
    const mangaIdMatch = $.html().match(/manga_id=(\d+)/);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chapters: any[] = [];
    // Chapter list from admin-ajax
    const chapterPromise = mangaIdMatch ? fetchHTML(`${KIRYUU_BASE}/wp-admin/admin-ajax.php?manga_id=${mangaIdMatch[1]}&page=1&action=chapter_list`).catch(() => null) : Promise.resolve(null);
    // Status and type from WP REST API (detail page doesn't have status, type can be wrong)
    const wpPromise = fetch(`${KIRYUU_BASE}/wp-json/wp/v2/manga?slug=${slug}&_embed=wp:term`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    }).then(r => r.ok ? r.json() : []).then(data => {
      const result = { status: "Unknown", type: "" };
      if (!data?.[0]?._embedded?.["wp:term"]) return result;
      for (const group of data[0]._embedded["wp:term"]) {
        for (const term of group) {
          if (term.taxonomy === "status") result.status = term.name || "Unknown";
          if (term.taxonomy === "type" && term.name && term.name !== "-") result.type = term.name;
        }
      }
      return result;
    }).catch(() => ({ status: "Unknown", type: "" }));
    const [ch$, wpData] = await Promise.all([chapterPromise, wpPromise]);
    if (ch$) {
      ch$("div[data-chapter-number]").each((_, el) => {
        const $ch = ch$(el);
        const chNum = $ch.attr("data-chapter-number") || "";
        const chLink = $ch.find("a").first();
        const chHref = chLink.attr("href") || "";
        const chTitle = $ch.find("span").first().text().trim() || `Chapter ${chNum}`;
        const chDate = $ch.find("time").attr("datetime") || "";
        if (!chHref) return;
        const path = chHref.replace(/https?:\/\/v1\.kiryuu\.to\/manga\//, "").replace(/\/$/, "");
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
    status = wpData.status !== "Unknown" ? wpData.status : status;
    if (wpData.type) type = wpData.type;
    // Override status with AniList (authoritative)
    const aniStatus = await fetchAniListStatus(title);
    if (aniStatus !== "Unknown") status = aniStatus;
    return apiResponse({
      title, thumbnail, image: thumbnail, description, type, status, author, artist,
      genre: genres, rating: rating || undefined, chapters, released,
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
      const p = href.replace(/https?:\/\/v1\.kiryuu\.to\/manga\//, "").replace(/\/$/, "");
      const ps = p.split("/");
      return ps.length >= 2 ? `${ps[0]}--${ps.slice(1).join("/")}` : undefined;
    };
    return apiResponse([{ title, panel: images, prev_chapter_id: encodeNav(prevHref), next_chapter_id: encodeNav(nextHref) }]);
  },

  genre: async (query, slug) => {
    if (slug) {
      const page = parseInt(query.page) || 1;
      const $ = await fetchHTML(`${KIRYUU_BASE}/genre/${slug}/page/${page}/`);
      return apiResponse(kiryuuParseListPage($));
    }
    const $ = await fetchHTML(`${KIRYUU_BASE}/manga/`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const genres: any[] = [];
    $("a[href*='/genre/']").each((_, el) => {
      const t = $(el).find("span").text().trim() || $(el).text().trim();
      const h = ($(el).attr("href") || "").replace(/https?:\/\/v1\.kiryuu\.to/, "").replace(/\/$/, "");
      const genreSlug = h.replace(/^\/genre\//, "");
      if (t && genreSlug && !genres.find(g => g.href === `/genre/${genreSlug}`)) {
        genres.push({ title: t, href: `/genre/${genreSlug}` });
      }
    });
    if (genres.length === 0) {
      const fallback = ["action","adventure","comedy","drama","fantasy","harem","horror","isekai",
        "martial-arts","mystery","psychological","romance","school-life","sci-fi","seinen",
        "shoujo","shounen","slice-of-life","sports","supernatural","thriller","tragedy"];
      return apiResponse(fallback.map(g => ({
        title: g.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        href: `/genre/${g}`,
      })));
    }
    return apiResponse(genres);
  },

  health: async () => ({ status: "ok", provider: "kiryuu", timestamp: new Date().toISOString() }),
};

// ─── Provider Routing ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers: Record<string, Record<string, (query: any, slug?: string) => Promise<any>>> = {
  shinigami: shinigamiHandlers,
  komiku: komikuHandlers,
  kiryuu: kiryuuHandlers,
};

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

    // Validate query params
    for (const [, val] of Object.entries(req.query)) {
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

    // Cache control — public cache for 2 min, stale-while-revalidate for 5 min
    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");

    return res.status(statusCode).json(result);
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json(apiError("Internal server error"));
  }
}
