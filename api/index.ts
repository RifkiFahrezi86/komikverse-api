import type { VercelRequest, VercelResponse } from "@vercel/node";
import { request } from "undici";
import crypto from "crypto";
import * as cheerio from "cheerio";

// ─── Security Config ───
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
const API_SECRET = process.env.API_SECRET || "";
const ENABLE_CONTENT_ANALYTICS = process.env.ENABLE_CONTENT_ANALYTICS === "1";

function appendVaryHeader(res: VercelResponse, value: string) {
  const current = res.getHeader("Vary");
  const currentValue = Array.isArray(current) ? current.join(", ") : String(current || "");
  const varyParts = currentValue
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!varyParts.some((part) => part.toLowerCase() === value.toLowerCase())) {
    varyParts.push(value);
  }

  if (varyParts.length > 0) {
    res.setHeader("Vary", varyParts.join(", "));
  }
}

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
const UPSTREAM_CACHE_LIMIT = 200;

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://09.shinigami.asia",
  Referer: "https://09.shinigami.asia/",
};

const PROVIDER_HEALTH_TTL = 60_000;
let providerHealthCache: { value: unknown; expiresAt: number } | null = null;

async function checkProviderOnline(id: string, url: string, accept = "application/json") {
  const startedAt = Date.now();
  try {
    const res = await request(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": accept,
        "Accept-Language": "id-ID,id;q=0.9",
      },
    } as any);

    const statusCode = res.statusCode || 0;
    const online = statusCode >= 200 && statusCode < 500;
    return {
      id,
      online,
      statusCode,
      responseMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      id,
      online: false,
      statusCode: 0,
      responseMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    };
  }
}

async function getProviderHealthStatus() {
  const now = Date.now();
  if (providerHealthCache && providerHealthCache.expiresAt > now) {
    return providerHealthCache.value;
  }

  const status = await Promise.all([
    checkProviderOnline("shinigami", `${API_BASE}/genre/list`, "application/json"),
    checkProviderOnline("komiku", `${KOMIKU_API}/?post_type=manga&s=one`, "text/html,application/xhtml+xml"),
    checkProviderOnline("komikindo", "https://komikindo.ch/", "text/html,application/xhtml+xml"),
  ]);

  providerHealthCache = {
    value: status,
    expiresAt: now + PROVIDER_HEALTH_TTL,
  };

  return status;
}

const upstreamCache = new Map<string, { value: unknown; expiresAt: number }>();
const upstreamInflight = new Map<string, Promise<unknown>>();

function getUpstreamCacheTtl(url: string): number {
  const normalized = url.toLowerCase();
  if (normalized.includes("/genre") || normalized.includes("genre/list")) return 10 * 60 * 1000;
  if (normalized.includes("/popular") || normalized.includes("/top") || normalized.includes("/trending") || normalized.includes("hot")) return 5 * 60 * 1000;
  if (normalized.includes("recommended") || normalized.includes("is_recommended=true")) return 5 * 60 * 1000;
  if (normalized.includes("/detail/") || normalized.includes("/manga/") || normalized.includes("/komik/")) return 10 * 60 * 1000;
  if (normalized.includes("/chapter/") || normalized.includes("/read/") || normalized.includes("chapter/detail")) return 10 * 60 * 1000;
  if (normalized.includes("search") || normalized.includes("?s=") || normalized.includes("q=")) return 2 * 60 * 1000;
  return 2 * 60 * 1000;
}

function pruneUpstreamCache() {
  const now = Date.now();
  for (const [key, entry] of upstreamCache.entries()) {
    if (entry.expiresAt <= now) upstreamCache.delete(key);
  }
  while (upstreamCache.size > UPSTREAM_CACHE_LIMIT) {
    const oldestKey = upstreamCache.keys().next().value;
    if (!oldestKey) break;
    upstreamCache.delete(oldestKey);
  }
}

async function getCachedUpstream<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const cached = upstreamCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  if (cached) upstreamCache.delete(key);

  if (upstreamInflight.has(key)) return upstreamInflight.get(key) as Promise<T>;

  const promise = loader()
    .then((value) => {
      upstreamCache.set(key, { value, expiresAt: Date.now() + ttl });
      pruneUpstreamCache();
      return value;
    })
    .finally(() => {
      upstreamInflight.delete(key);
    });

  upstreamInflight.set(key, promise as Promise<unknown>);
  return promise;
}

// ─── Fetch with retry ───
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<unknown> {
  return getCachedUpstream(`shinigami:${url}`, getUpstreamCacheTtl(url), async () => {
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
  });
}

// ─── HTML Scraping Utility ───
async function fetchHTML(url: string): Promise<cheerio.CheerioAPI> {
  const html = await getCachedUpstream(`html:${url}`, getUpstreamCacheTtl(url), async () => {
    const { statusCode, body } = await request(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
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
    const htmlText = await body.text();
    if (statusCode !== 200) throw new Error(`HTTP ${statusCode} from ${url}`);
    return htmlText;
  });
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

const MANGADEX_API = "https://api.mangadex.org";
const MANGADEX_COVERS_BASE = "https://uploads.mangadex.org/covers";
const MANGADEX_ROUTE_PROVIDER = "mangadex";
const MANGADEX_WEBTOON_ORIGINAL_LANGUAGES = ["ko"] as const;
const MANGADEX_WEBTOON_TRANSLATED_LANGUAGES = ["id", "en"] as const;
const MANGADEX_SAFE_CONTENT_RATINGS = ["safe", "suggestive"] as const;
const MANGADEX_MAX_WEBTOON_LIMIT = 24;
const MANGADEX_DETAIL_CHAPTER_LIMIT = 100;
const MANGADEX_DETAIL_FEED_PAGES = 1;

const MANGADEX_WEBTOON_THEMES = {
  romance: {
    tags: ["Romance", "Fantasy"],
    includedTagsMode: "OR",
    demographics: ["shoujo", "josei"],
    keywords: [] as string[],
  },
  kerajaan: {
    tags: ["Romance", "Historical", "Fantasy", "Reincarnation"],
    includedTagsMode: "OR",
    demographics: ["shoujo", "josei"],
    keywords: [
      "princess",
      "prince",
      "duke",
      "duchess",
      "villainess",
      "empress",
      "emperor",
      "palace",
      "royal",
      "noble",
      "historical",
      "lady",
      "countess",
      "kingdom",
    ],
  },
} as const;

type MangadexWebtoonTheme = keyof typeof MANGADEX_WEBTOON_THEMES;

function getMangadexCacheTtl(requestUrl: string): number {
  const normalized = requestUrl.toLowerCase();
  if (normalized.includes("/manga/tag")) return 12 * 60 * 60 * 1000;
  if (normalized.includes("/at-home/server/")) return 2 * 60 * 60 * 1000;
  if (normalized.includes("/feed?")) return 60 * 60 * 1000;
  if (/\/manga\/[0-9a-f-]+\?/.test(normalized)) return 60 * 60 * 1000;
  if (normalized.includes("title=")) return 10 * 60 * 1000;
  return 30 * 60 * 1000;
}

async function fetchMangadexJson<T>(path: string, query?: URLSearchParams): Promise<T> {
  const requestUrl = `${MANGADEX_API}${path}${query && query.toString() ? `?${query.toString()}` : ""}`;
  return getCachedUpstream(`mangadex:${requestUrl}`, getMangadexCacheTtl(requestUrl), async () => {
    const { statusCode, body, headers } = await request(requestUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      maxRedirections: 0,
    } as any);

    const contentType = String(headers["content-type"] || "").toLowerCase();
    const text = await body.text();

    if (statusCode !== 200) {
      throw new Error(`MangaDex upstream error ${statusCode}`);
    }

    if (!contentType.includes("application/json")) {
      throw new Error("MangaDex upstream returned non-JSON content");
    }

    return JSON.parse(text) as T;
  });
}

function pickMangadexText(value: Record<string, string> | undefined): string {
  if (!value || typeof value !== "object") return "";
  return value.id || value.en || value["ja-ro"] || value.ja || Object.values(value)[0] || "";
}

function normalizeMangadexText(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugifyMangadexTag(value: string): string {
  return normalizeMangadexText(value).replace(/\s+/g, "-");
}

function resolveMangadexTheme(value: string | undefined): MangadexWebtoonTheme {
  return value === "kerajaan" ? "kerajaan" : "romance";
}

function mapMangadexType(language: string | undefined): string {
  const normalized = String(language || "").toLowerCase();
  if (normalized === "ko") return "Manhwa";
  if (normalized.startsWith("zh")) return "Manhua";
  return "Manga";
}

function mapMangadexStatus(status: string | undefined): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "ongoing":
      return "Ongoing";
    case "hiatus":
      return "Hiatus";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unknown";
  }
}

function getMangadexRelationshipAttributes(relationships: any[], type: string): any[] {
  return (relationships || [])
    .filter((relationship) => relationship?.type === type && relationship?.attributes)
    .map((relationship) => relationship.attributes);
}

function proxyMangadexAssetUrl(url: string, width?: number): string {
  if (!url) return "";
  if (url.includes("wsrv.nl/?")) return url;

  const query = new URLSearchParams({
    url,
    default: "1",
  });

  if (typeof width === "number" && width > 0) {
    query.set("w", String(width));
  }

  return `https://wsrv.nl/?${query.toString()}`;
}

function getMangadexCoverUrl(mangaId: string, relationships: any[], variant: "thumb" | "full" = "thumb"): string {
  const coverArt = (relationships || []).find((relationship) => relationship?.type === "cover_art");
  const fileName = coverArt?.attributes?.fileName;
  if (!fileName) return "";
  const rawUrl = variant === "full"
    ? `${MANGADEX_COVERS_BASE}/${mangaId}/${fileName}`
    : `${MANGADEX_COVERS_BASE}/${mangaId}/${fileName}.256.jpg`;

  return proxyMangadexAssetUrl(rawUrl, variant === "thumb" ? 256 : undefined);
}

function getMangadexTagNames(tags: any[]): string[] {
  return (tags || [])
    .map((tag) => pickMangadexText(tag?.attributes?.name))
    .filter(Boolean);
}

async function getMangadexTagMap(): Promise<Map<string, string>> {
  const result = await fetchMangadexJson<any>("/manga/tag");
  const map = new Map<string, string>();
  for (const tag of result?.data || []) {
    const name = normalizeMangadexText(pickMangadexText(tag?.attributes?.name));
    if (name && typeof tag?.id === "string") {
      map.set(name, tag.id);
    }
  }
  return map;
}

async function resolveMangadexTagIds(names: readonly string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const map = await getMangadexTagMap();
  return names
    .map((name) => map.get(normalizeMangadexText(name)) || "")
    .filter(Boolean);
}

function getMangadexWebtoonScore(raw: any, theme: MangadexWebtoonTheme): number {
  if (theme !== "kerajaan") return 0;

  const attrs = raw?.attributes || {};
  const text = normalizeMangadexText([
    pickMangadexText(attrs.title),
    pickMangadexText(attrs.description),
    ...getMangadexTagNames(attrs.tags || []),
  ].join(" "));
  const padded = ` ${text} `;

  let score = 0;
  for (const keyword of MANGADEX_WEBTOON_THEMES.kerajaan.keywords) {
    if (padded.includes(` ${keyword} `)) score += 3;
  }
  if (padded.includes(" romance ")) score += 4;
  if (padded.includes(" historical ")) score += 5;
  if (padded.includes(" fantasy ")) score += 2;
  if (String(attrs.originalLanguage || "").toLowerCase() === "ko") score += 2;

  return score;
}

function transformMangadexComic(raw: any): any {
  const attrs = raw?.attributes || {};
  const relationships = raw?.relationships || [];
  const genreNames = getMangadexTagNames(attrs.tags || []);
  const authors = getMangadexRelationshipAttributes(relationships, "author")
    .map((author) => author?.name)
    .filter(Boolean)
    .join(", ");

  return {
    title: pickMangadexText(attrs.title),
    thumbnail: getMangadexCoverUrl(raw.id, relationships, "thumb"),
    image: getMangadexCoverUrl(raw.id, relationships, "full") || getMangadexCoverUrl(raw.id, relationships, "thumb"),
    href: `/manga/${raw.id}`,
    type: mapMangadexType(attrs.originalLanguage),
    chapter: attrs.lastChapter ? `Chapter ${attrs.lastChapter}` : undefined,
    description: pickMangadexText(attrs.description),
    genre: genreNames.join(", "),
    status: mapMangadexStatus(attrs.status),
    author: authors || undefined,
  };
}

function transformMangadexChapters(rawChapters: any[]): any[] {
  const chapterMap = new Map<string, { chapter: any; language: string; publishedAt: number }>();

  for (const raw of rawChapters || []) {
    const attrs = raw?.attributes || {};
    const parsedChapterNumber = typeof attrs.chapter === "string" ? Number(attrs.chapter) : NaN;
    const chapterNumber = Number.isFinite(parsedChapterNumber) ? parsedChapterNumber : undefined;
    const key = typeof chapterNumber === "number" ? chapterNumber.toFixed(3) : raw?.id;
    if (!key) continue;

    const translatedLanguage = String(attrs.translatedLanguage || "").toLowerCase();
    const candidate = {
      title: attrs.title
        ? `Chapter ${attrs.chapter || ""} - ${attrs.title}`.trim()
        : `Chapter ${attrs.chapter || ""}`.trim(),
      href: `/chapter/${raw.id}`,
      date: attrs.publishAt || attrs.readableAt || attrs.createdAt || undefined,
      number: chapterNumber,
      provider: MANGADEX_ROUTE_PROVIDER,
    };

    const publishedAt = Date.parse(attrs.publishAt || attrs.readableAt || attrs.createdAt || "") || 0;
    const existing = chapterMap.get(key);

    const shouldReplace = !existing
      || (translatedLanguage === "id" && existing.language !== "id")
      || (translatedLanguage === existing.language && publishedAt > existing.publishedAt);

    if (shouldReplace) {
      chapterMap.set(key, { chapter: candidate, language: translatedLanguage, publishedAt });
    }
  }

  return Array.from(chapterMap.values())
    .map((entry) => entry.chapter)
    .sort((left, right) => {
      const leftNumber = typeof left.number === "number" ? left.number : 0;
      const rightNumber = typeof right.number === "number" ? right.number : 0;
      if (rightNumber !== leftNumber) return rightNumber - leftNumber;
      return Date.parse(String(right.date || "")) - Date.parse(String(left.date || ""));
    });
}

async function fetchMangadexFeed(mangaId: string): Promise<any[]> {
  const chapters: any[] = [];

  for (let pageIndex = 0; pageIndex < MANGADEX_DETAIL_FEED_PAGES; pageIndex += 1) {
    const offset = pageIndex * MANGADEX_DETAIL_CHAPTER_LIMIT;
    const query = new URLSearchParams({
      limit: String(MANGADEX_DETAIL_CHAPTER_LIMIT),
      offset: String(offset),
      "order[chapter]": "desc",
      "order[volume]": "desc",
    });
    query.append("includes[]", "scanlation_group");
    for (const language of MANGADEX_WEBTOON_TRANSLATED_LANGUAGES) {
      query.append("translatedLanguage[]", language);
    }

    const result = await fetchMangadexJson<any>(`/manga/${encodeURIComponent(mangaId)}/feed`, query);
    const items = Array.isArray(result?.data) ? result.data : [];
    chapters.push(...items);

    const total = typeof result?.total === "number" ? result.total : items.length;
    const limit = typeof result?.limit === "number" ? result.limit : MANGADEX_DETAIL_CHAPTER_LIMIT;
    if (offset + limit >= total) break;
  }

  return chapters;
}

async function fetchMangadexMangaById(mangaId: string): Promise<any | null> {
  const query = new URLSearchParams({
    limit: "1",
  });
  query.append("ids[]", mangaId);
  query.append("includes[]", "cover_art");
  query.append("includes[]", "author");
  query.append("includes[]", "artist");

  const result = await fetchMangadexJson<any>("/manga", query);
  const items = Array.isArray(result?.data) ? result.data : [];
  return items.find((item: any) => item?.id === mangaId) || items[0] || null;
}

async function fetchMangadexWebtoonList(query: any): Promise<any> {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(MANGADEX_MAX_WEBTOON_LIMIT, Math.max(1, parseInt(query.limit) || MANGADEX_MAX_WEBTOON_LIMIT));
  const keyword = typeof query.keyword === "string" ? query.keyword.trim() : "";
  const theme = resolveMangadexTheme(typeof query.theme === "string" ? query.theme.toLowerCase() : undefined);
  const themeConfig = MANGADEX_WEBTOON_THEMES[theme];

  const requestQuery = new URLSearchParams({
    limit: String(limit),
    offset: String((page - 1) * limit),
    "order[followedCount]": "desc",
    "order[latestUploadedChapter]": "desc",
  });

  if (keyword) requestQuery.set("title", keyword);
  requestQuery.append("includes[]", "cover_art");

  for (const language of MANGADEX_WEBTOON_TRANSLATED_LANGUAGES) {
    requestQuery.append("availableTranslatedLanguage[]", language);
  }
  for (const language of MANGADEX_WEBTOON_ORIGINAL_LANGUAGES) {
    requestQuery.append("originalLanguage[]", language);
  }
  for (const rating of MANGADEX_SAFE_CONTENT_RATINGS) {
    requestQuery.append("contentRating[]", rating);
  }
  for (const demographic of themeConfig.demographics) {
    requestQuery.append("publicationDemographic[]", demographic);
  }

  const tagIds = await resolveMangadexTagIds(themeConfig.tags);
  for (const tagId of tagIds) {
    requestQuery.append("includedTags[]", tagId);
  }
  if (tagIds.length > 0) {
    requestQuery.set("includedTagsMode", themeConfig.includedTagsMode);
  }

  const result = await fetchMangadexJson<any>("/manga", requestQuery);
  let items = Array.isArray(result?.data) ? result.data : [];

  if (theme === "kerajaan") {
    items = items
      .map((item: any) => ({ item, score: getMangadexWebtoonScore(item, theme) }))
      .filter((entry: { item: any; score: number }) => entry.score > 0)
      .sort((left: { item: any; score: number }, right: { item: any; score: number }) => right.score - left.score)
      .map((entry: { item: any; score: number }) => entry.item);
  }

  const total = typeof result?.total === "number" ? result.total : items.length;
  const offset = typeof result?.offset === "number" ? result.offset : (page - 1) * limit;
  const responseLimit = typeof result?.limit === "number" ? result.limit : limit;

  return apiResponse(items.map(transformMangadexComic), {
    current_page: page,
    length_page: Math.max(1, Math.ceil(total / Math.max(responseLimit, 1))),
    has_next: offset + responseLimit < total,
    has_prev: page > 1,
  });
}

async function fetchMangadexWebtoonDetail(mangaId: string): Promise<any> {
  const manga = await fetchMangadexMangaById(mangaId).catch(() => null);
  const feedResult = await fetchMangadexFeed(mangaId).catch(() => []);
  if (!manga?.id) return apiError("Webtoon tidak ditemukan", 404);

  const attrs = manga.attributes || {};
  const relationships = manga.relationships || [];
  const genreNames = getMangadexTagNames(attrs.tags || []);
  const authors = getMangadexRelationshipAttributes(relationships, "author")
    .map((author) => author?.name)
    .filter(Boolean)
    .join(", ");
  const artists = getMangadexRelationshipAttributes(relationships, "artist")
    .map((artist) => artist?.name)
    .filter(Boolean)
    .join(", ");

  const alternativeTitles = (attrs.altTitles || [])
    .map((title: Record<string, string>) => pickMangadexText(title))
    .filter(Boolean)
    .join(", ");

  return apiResponse({
    title: pickMangadexText(attrs.title),
    thumbnail: getMangadexCoverUrl(manga.id, relationships, "thumb"),
    image: getMangadexCoverUrl(manga.id, relationships, "full") || getMangadexCoverUrl(manga.id, relationships, "thumb"),
    description: pickMangadexText(attrs.description),
    type: mapMangadexType(attrs.originalLanguage),
    status: mapMangadexStatus(attrs.status),
    author: authors || undefined,
    artist: artists || undefined,
    genre: genreNames.map((genre) => ({ title: genre, href: `/genre/${slugifyMangadexTag(genre)}` })),
    chapters: transformMangadexChapters(feedResult),
    alternative: alternativeTitles || undefined,
    released: attrs.year ? String(attrs.year) : undefined,
  });
}

async function fetchMangadexWebtoonChapter(chapterId: string): Promise<any> {
  const chapterResult = await fetchMangadexJson<any>(`/chapter/${encodeURIComponent(chapterId)}`);
  const chapterInfo = chapterResult?.data;
  if (!chapterInfo?.id) return apiError("Chapter webtoon tidak ditemukan", 404);

  const atHomeResult = await fetchMangadexJson<any>(`/at-home/server/${encodeURIComponent(chapterId)}`);
  const chapter = atHomeResult?.chapter;
  if (!chapter?.hash || !Array.isArray(chapter?.data)) {
    return apiError("Gagal mengambil halaman webtoon", 502);
  }

  const chapterAttrs = chapterInfo.attributes || {};
  const title = chapterAttrs.title
    ? `Chapter ${chapterAttrs.chapter || ""} - ${chapterAttrs.title}`.trim()
    : `Chapter ${chapterAttrs.chapter || ""}`.trim();
  const baseUrl = String(atHomeResult?.baseUrl || "").replace(/\/$/, "");
  const panel = chapter.data.map((file: string) => `${baseUrl}/data/${chapter.hash}/${file}`);

  return apiResponse([{ title, panel }]);
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

const standaloneHandlers: Record<string, (query: any, slug?: string) => Promise<any>> = {
  webtoon: async (query) => fetchMangadexWebtoonList(query),
  webtoondetail: async (_query, slug) => {
    if (!slug) return apiError("Slug required", 400);
    return fetchMangadexWebtoonDetail(slug);
  },
  webtoonread: async (_query, slug) => {
    if (!slug) return apiError("Slug required", 400);
    return fetchMangadexWebtoonChapter(slug);
  },
};

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

  health: async () => {
    const providersStatus = await getProviderHealthStatus();
    return {
      status: "ok",
      providers: providersStatus,
      timestamp: new Date().toISOString(),
    };
  },
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

function decodeHtml(s: string): string {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#8211;/g, "–").replace(/&#8217;/g, "\u2019")
    .replace(/&#8220;/g, "\u201C").replace(/&#8221;/g, "\u201D");
}
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
  const otherProviders = ["shinigami", "komiku"].filter(p => p !== currentProvider);
  const existingNumbers = new Set(numbers);

  for (const fallbackProvider of otherProviders) {
    try {
      let fallbackChapters: any[] = [];

      // Try each title until we find chapters
      for (const searchTitle of titlesToTry) {
        if (fallbackProvider === "komiku") {
          fallbackChapters = await fetchKomikuChaptersForMerge(searchTitle);
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
// ─── Komikindo Provider (komikindo.ch) ───
const KOMIKINDO_HTML_CACHE_LIMIT = 200;
const komikindoHtmlCache = new Map<string, { body: string; expiresAt: number }>();
const komikindoInflight = new Map<string, Promise<cheerio.CheerioAPI>>();
const KOMIKINDO_SNAPSHOT_CACHE_LIMIT = 300;
const komikindoSnapshotCache = new Map<string, { value: unknown; expiresAt: number; staleUntil: number }>();
const komikindoSnapshotInflight = new Map<string, Promise<unknown>>();

function getKomikindoSnapshotPolicy(key: string): { ttl: number; staleTtl: number } {
  if (key.startsWith("genre:")) return { ttl: 30 * 60 * 1000, staleTtl: 48 * 60 * 60 * 1000 };
  if (key.startsWith("popular:")) return { ttl: 15 * 60 * 1000, staleTtl: 24 * 60 * 60 * 1000 };
  if (key.startsWith("detail:")) return { ttl: 30 * 60 * 1000, staleTtl: 24 * 60 * 60 * 1000 };
  if (key.startsWith("read:")) return { ttl: 60 * 60 * 1000, staleTtl: 48 * 60 * 60 * 1000 };
  if (key.startsWith("search:")) return { ttl: 5 * 60 * 1000, staleTtl: 12 * 60 * 60 * 1000 };
  return { ttl: 10 * 60 * 1000, staleTtl: 12 * 60 * 60 * 1000 };
}

function pruneKomikindoSnapshotCache() {
  if (komikindoSnapshotCache.size <= KOMIKINDO_SNAPSHOT_CACHE_LIMIT) return;
  const entries = Array.from(komikindoSnapshotCache.entries());
  entries.sort((a, b) => a[1].staleUntil - b[1].staleUntil);
  while (komikindoSnapshotCache.size > KOMIKINDO_SNAPSHOT_CACHE_LIMIT && entries.length) {
    const oldest = entries.shift();
    if (!oldest) break;
    komikindoSnapshotCache.delete(oldest[0]);
  }
}

function storeKomikindoSnapshot(key: string, value: unknown) {
  const now = Date.now();
  const policy = getKomikindoSnapshotPolicy(key);
  komikindoSnapshotCache.set(key, {
    value,
    expiresAt: now + policy.ttl,
    staleUntil: now + policy.staleTtl,
  });
  pruneKomikindoSnapshotCache();
}

async function getKomikindoSnapshot<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = komikindoSnapshotCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const inflight = komikindoSnapshotInflight.get(key);
  if (inflight) return inflight as Promise<T>;

  if (cached && cached.staleUntil > now) {
    const refreshPromise = (async () => {
      try {
        const value = await loader();
        storeKomikindoSnapshot(key, value);
        return value;
      } finally {
        komikindoSnapshotInflight.delete(key);
      }
    })();

    komikindoSnapshotInflight.set(key, refreshPromise);
    return cached.value as T;
  }

  const promise = (async () => {
    try {
      const value = await loader();
      storeKomikindoSnapshot(key, value);
      return value;
    } finally {
      komikindoSnapshotInflight.delete(key);
    }
  })();

  komikindoSnapshotInflight.set(key, promise);
  return promise;
}

function getKomikindoCacheTtl(url: string): number {
  const normalized = url.toLowerCase();
  if (normalized.includes("/komik-terbaru") || normalized.includes("/komik-populer")) return 5 * 60 * 1000;
  if (normalized.includes("/?s=")) return 2 * 60 * 1000;
  if (normalized.includes("/komik/")) return 10 * 60 * 1000;
  if (normalized.includes("-chapter-")) return 15 * 60 * 1000;
  return 3 * 60 * 1000;
}

function pruneKomikindoCache() {
  if (komikindoHtmlCache.size <= KOMIKINDO_HTML_CACHE_LIMIT) return;
  const entries = Array.from(komikindoHtmlCache.entries());
  entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  while (komikindoHtmlCache.size > KOMIKINDO_HTML_CACHE_LIMIT && entries.length) {
    const oldest = entries.shift();
    if (!oldest) break;
    komikindoHtmlCache.delete(oldest[0]);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchHTMLKomikindo(url: string): Promise<cheerio.CheerioAPI> {
  const now = Date.now();
  const cached = komikindoHtmlCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cheerio.load(cached.body);
  }

  const inflight = komikindoInflight.get(url);
  if (inflight) return inflight;

  const fetchPromise = (async () => {
  try {
    const res = await request(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "id-ID,id;q=0.9",
      },
    } as any);
    const body = await res.body.text();
    komikindoHtmlCache.set(url, {
      body,
      expiresAt: now + getKomikindoCacheTtl(url),
    });
    pruneKomikindoCache();
    return cheerio.load(body);
  } catch (error) {
    console.error("Komikindo fetch error:", error);
    throw new Error("Gagal mengambil data dari Komikindo");
  } finally {
    komikindoInflight.delete(url);
  }
  })();

  komikindoInflight.set(url, fetchPromise);
  return fetchPromise;
}

function getKomikindoPagedUrl(basePath: string, page: number, query?: URLSearchParams): string {
  const normalizedPage = Number.isFinite(page) && page > 1 ? page : 1;
  const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const path = normalizedPage > 1 ? `${normalizedBase}page/${normalizedPage}/` : normalizedBase;
  const qs = query && query.toString() ? `?${query.toString()}` : "";
  return `https://komikindo.ch${path}${qs}`;
}

function getKomikindoType(typeFlagClass: string, fallbackText = ""): string | undefined {
  const combined = `${typeFlagClass} ${fallbackText}`;
  const match = combined.match(/\b(Manga|Manhwa|Manhua|Webtoon)\b/i);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function komikindoParseListPage($: cheerio.CheerioAPI): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comics: any[] = [];
  const seen = new Set<string>();

  $("#content .listupd .animepost, .postbody .listupd .animepost, .widget-body .listupd .animepost").each((_, el) => {
    const $card = $(el).find(".animposx").first().length ? $(el).find(".animposx").first() : $(el);
    const headingLink = $card.find(".tt a[href*='/komik/'], h3 a[href*='/komik/']").first();
    const titleLink = headingLink.length
      ? headingLink
      : $card.find("> a[href*='/komik/'], a[href*='/komik/']").first();
    const link = titleLink.attr("href") || $card.find("a[href*='/komik/']").first().attr("href") || "";
    const slug = link.replace(/^.*\/komik\//, "").replace(/\/$/, "");
    const title = titleLink.text().trim() || titleLink.attr("title")?.replace(/^Komik\s+/i, "").trim() || "";
    if (!slug || !title || seen.has(slug)) return;

    const img = $card.find(".limit img, img[itemprop='image'], img").first();
    const thumbnail = img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src") || "";
    const typeFlag = $card.find(".typeflag").first();
    const type = getKomikindoType(typeFlag.attr("class") || "", typeFlag.text().trim()) || "Manga";
    const latestChapter = $card.find(".lsch a").first().text().replace(/\s+/g, " ").trim() || undefined;
    const rating = $card.find(".rating i").first().text().trim() || undefined;
    const date = $card.find(".datech").first().text().replace(/\s+/g, " ").trim();

    comics.push({
      title,
      thumbnail: thumbnail || "",
      image: thumbnail || "",
      href: `/komik/${slug}`,
      type,
      chapter: latestChapter,
      rating,
      description: date || undefined,
    });
    seen.add(slug);
  });

  return comics;
}

function extractKomikindoChapterSlug(href: string): string {
  return href
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .split("?")[0];
}

function komikindoMetaField($: cheerio.CheerioAPI, label: string): string {
  return $(`span b:contains("${label}")`)
    .first()
    .parent()
    .clone()
    .find("b")
    .remove()
    .end()
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function komikindoFetchComicDetail($: cheerio.CheerioAPI): Promise<any> {
  // Title — strip "Komik " prefix injected by Komikindo
  const title = ($("h1.entry-title, h1").first().text() || $("title").text().split("|")[0])
    .replace(/^\s*Komik\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  // Cover image — inside div.thumb which holds the poster
  const thumbnail = $("div.thumb img").first().attr("src")
    || $("img[src*='wp-content/uploads']").not("[src*='logo'], [src*='fav']").first().attr("src")
    || "";

  // Metadata fields — each is a <span><b>Label:</b> value</span>
  const typeRaw = komikindoMetaField($, "Jenis Komik:");
  const type = /Manhwa/i.test(typeRaw) ? "Manhwa" : /Manhua/i.test(typeRaw) ? "Manhua" : /Manga/i.test(typeRaw) ? "Manga" : "Manga";

  const statusRaw = komikindoMetaField($, "Status:");
  const status = /Tamat|Completed/i.test(statusRaw) ? "Completed"
    : /Ongoing|Berlangsung/i.test(statusRaw) ? "Ongoing"
    : /Hiatus/i.test(statusRaw) ? "Hiatus"
    : statusRaw || "Unknown";

  const author = komikindoMetaField($, "Pengarang:") || komikindoMetaField($, "Author:");
  const artist = komikindoMetaField($, "Ilustrator:") || komikindoMetaField($, "Artist:");
  const alternative = komikindoMetaField($, "Judul Alternatif:") || komikindoMetaField($, "Alternative:");
  const released = komikindoMetaField($, "Rilis:") || komikindoMetaField($, "Released:");
  const rating = $(".rtg i, .archiveanime-rating i, .ratingmanga i").first().text().trim();

  // Genres
  const genre = $(".genre-info a").map((_, el) => $(el).text().trim()).get().join(", ");

  // Description — .shortcsc p is the synopsis paragraph
  const description = $(".shortcsc p, .shortcsc").first().text()
    .replace(/\s+/g, " ")
    .trim();

  // Chapters — collect chapter links, deduplicate, prefer entries with chapter numbers in the title
  const chapterMap = new Map<string, { title: string; href: string; number: number }>();
  $("a[href*='-chapter-']").each((_, el) => {
    const href = ($(el).attr("href") || "").replace(/\/$/, "").split("?")[0];
    if (!href) return;
    const slug = extractKomikindoChapterSlug(href);
    if (!slug) return;
    const rawTitle = $(el).text().replace(/\s+/g, " ").trim();
    // Only accept links whose visible text looks like a chapter label, not a date
    const numMatch = rawTitle.match(/chapter\s*(\d+(?:\.\d+)?)/i);
    if (!numMatch) return;
    const number = parseFloat(numMatch[1]);
    const key = slug;
    const existing = chapterMap.get(key);
    if (!existing || number > (existing.number || 0)) {
      chapterMap.set(key, { title: rawTitle, href: `/chapter/${slug}`, number });
    }
  });

  const chapters = Array.from(chapterMap.values())
    .sort((a, b) => b.number - a.number)
    .map((ch) => ({ ...ch, provider: "komikindo" as const }));

  return {
    title,
    description,
    thumbnail,
    image: thumbnail,
    type,
    status,
    author,
    artist,
    alternative,
    released,
    rating,
    genre,
    chapters,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function komikindoFetchChapterImages($: cheerio.CheerioAPI): Promise<string[]> {
  const images: string[] = [];

  // Try multiple selectors for image containers
  $("img[data-src], img[src*='komik'], [class*='image'] img, .reader img, [class*='chapter'] img").each((_, el) => {
    const src = $(el).attr("data-src") || $(el).attr("src") || "";
    if (src && !src.includes("logo") && !src.includes("banner") && !src.includes("ads")) {
      images.push(src);
    }
  });

  return images.filter((img, idx, arr) => arr.indexOf(img) === idx); // dedupe
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const komikindoHandlers: Record<string, (query: any, slug?: string) => Promise<any>> = {
  terbaru: async (query) => {
    try {
      const page = parseInt(query.page) || 1;
      const comics = await getKomikindoSnapshot(`terbaru:${page}`, async () => {
        const url = getKomikindoPagedUrl("/komik-terbaru/", page);
        const $ = await fetchHTMLKomikindo(url);
        return komikindoParseListPage($);
      });
      return apiResponse(comics);
    } catch (error) {
      return apiError("Gagal fetch komik terbaru", 500);
    }
  },

  popular: async (query) => {
    try {
      const page = parseInt(query.page) || 1;
      const comics = await getKomikindoSnapshot(`popular:${page}`, async () => {
        const url = getKomikindoPagedUrl("/komik-populer/", page);
        const $ = await fetchHTMLKomikindo(url);
        return komikindoParseListPage($);
      });
      return apiResponse(comics);
    } catch (error) {
      return apiError("Gagal fetch komik populer", 500);
    }
  },

  search: async (query) => {
    try {
      const keyword = query.keyword || query.q || "";
      if (!keyword) return apiError("Keyword required", 400);
      const page = parseInt(query.page) || 1;
      const searchKey = String(keyword).trim().toLowerCase();
      const comics = await getKomikindoSnapshot(`search:${searchKey}:${page}`, async () => {
        const url = getKomikindoPagedUrl("/", page, new URLSearchParams({ s: String(keyword) }));
        const $ = await fetchHTMLKomikindo(url);
        return komikindoParseListPage($);
      });
      return apiResponse(comics);
    } catch (error) {
      return apiError("Gagal cari komik", 500);
    }
  },

  detail: async (_query, slug) => {
    try {
      if (!slug) return apiError("Slug required", 400);
      const detail = await getKomikindoSnapshot(`detail:${slug}`, async () => {
        const url = `https://komikindo.ch/komik/${slug}/`;
        const $ = await fetchHTMLKomikindo(url);
        return komikindoFetchComicDetail($);
      });
      return apiResponse(detail);
    } catch (error) {
      return apiError("Komik tidak ditemukan", 404);
    }
  },

  read: async (_query, slug) => {
    try {
      if (!slug) return apiError("Slug required", 400);
      const chapterData = await getKomikindoSnapshot(`read:${slug}`, async () => {
        const url = `https://komikindo.ch/${slug}/`;
        const $ = await fetchHTMLKomikindo(url);
        const panel = await komikindoFetchChapterImages($);
        return [{ title: slug, panel }];
      });
      return apiResponse(chapterData);
    } catch (error) {
      return apiError("Chapter tidak ditemukan", 404);
    }
  },

  genre: async (query, slug) => {
    try {
      if (slug) {
        const page = parseInt(query.page) || 1;
        const comics = await getKomikindoSnapshot(`genre:${slug}:${page}`, async () => {
          const url = getKomikindoPagedUrl(`/genre/${slug}/`, page);
          const $ = await fetchHTMLKomikindo(url);
          return komikindoParseListPage($);
        });
        return apiResponse(comics);
      }
      // Return hardcoded genre list
      const genres = await getKomikindoSnapshot("genre:list", async () => ["action", "adventure", "comedy", "drama", "ecchi", "fantasy", "horror", "isekai", "romance", "school", "shounen"]);
      return apiResponse(genres.map(g => ({
        title: g.charAt(0).toUpperCase() + g.slice(1),
        href: `/genre/${g}`,
      })));
    } catch (error) {
      return apiError("Gagal fetch genre", 500);
    }
  },

  health: async () => ({ status: "ok", provider: "komikindo", timestamp: new Date().toISOString() }),
};

// ─── Provider Routing ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const providers: Record<string, Record<string, (query: any, slug?: string) => Promise<any>>> = {
  shinigami: shinigamiHandlers,
  komiku: komikuHandlers,
  komikindo: komikindoHandlers,
};

// ─── Analytics Tracking (fire-and-forget) ───
let _analyticsQuery: any;
let _analyticsMigrated = false;

async function getAnalyticsDb() {
  if (!ENABLE_CONTENT_ANALYTICS) return null;
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
  if (!ENABLE_CONTENT_ANALYTICS) return;
  // Keep Komikindo scraper route stateless and avoid Neon compute writes.
  if (provider === "komikindo" || provider === MANGADEX_ROUTE_PROVIDER) return;
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
  appendVaryHeader(res, "Origin");
  if (allowedOrigin) res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
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

    let analyticsProvider = (typeof req.query.provider === "string" ? req.query.provider : "shinigami").toLowerCase();
    let handlerFn: ((query: any, slug?: string) => Promise<any>) | undefined;

    if (route === "health") {
      handlerFn = shinigamiHandlers.health;
      analyticsProvider = "health";
    } else if (standaloneHandlers[route]) {
      handlerFn = standaloneHandlers[route];
      analyticsProvider = MANGADEX_ROUTE_PROVIDER;
    } else {
      const provider = analyticsProvider;
      const providerHandlers = providers[provider];
      if (!providerHandlers) {
        return res.status(400).json(apiError(`Unknown provider: ${provider}`, 400));
      }
      handlerFn = providerHandlers[route];
    }

    if (!handlerFn) {
      return res.status(404).json(apiError("Endpoint not found", 404));
    }

    const result = await handlerFn(req.query, slug);
    const statusCode = result.code && result.status === "error" ? result.code : 200;

    // Track request (fire-and-forget, non-blocking)
    if (analyticsProvider !== "health") {
      trackRequest(req, `/${route}${slug ? "/" + slug : ""}`, analyticsProvider);
    }

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
    const komikindoCacheMap: Record<string, string> = {
      genre:       "public, s-maxage=1800, stale-while-revalidate=3600", // 30 min + 1 hr stale
      popular:     "public, s-maxage=600, stale-while-revalidate=1800",  // 10 min + 30 min stale
      detail:      "public, s-maxage=900, stale-while-revalidate=3600",  // 15 min + 1 hr stale
      terbaru:     "public, s-maxage=300, stale-while-revalidate=900",   // 5 min + 15 min stale
      search:      "public, s-maxage=180, stale-while-revalidate=600",   // 3 min + 10 min stale
      read:        "public, s-maxage=1800, stale-while-revalidate=7200", // 30 min + 2 hr stale
      health:      "no-cache",
    };
    const mangadexCacheMap: Record<string, string> = {
      webtoon:       "public, s-maxage=1800, stale-while-revalidate=14400",     // 30 min + 4 hr stale
      webtoondetail: "public, s-maxage=3600, stale-while-revalidate=21600",     // 1 hr + 6 hr stale
      webtoonread:   "public, s-maxage=3600, stale-while-revalidate=21600",     // 1 hr + 6 hr stale
    };
    const activeCacheMap = analyticsProvider === "komikindo"
      ? komikindoCacheMap
      : analyticsProvider === MANGADEX_ROUTE_PROVIDER
        ? mangadexCacheMap
        : cacheMap;
    res.setHeader("Cache-Control", activeCacheMap[route] || "public, s-maxage=120, stale-while-revalidate=300");

    return res.status(statusCode).json(result);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("API Error:", errMsg, error);
    return res.status(500).json(apiError("Internal server error"));
  }
}
