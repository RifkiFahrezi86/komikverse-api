import { request } from "undici";

const API_BASE = "https://api.shngm.io/v1";
const MAX_RETRIES = 8;
const RETRY_DELAY = 800;

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  Origin: "https://09.shinigami.asia",
  Referer: "https://09.shinigami.asia/",
};

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<unknown> {
  for (let i = 0; i < retries; i++) {
    try {
      const { statusCode, body } = await request(url, {
        headers: DEFAULT_HEADERS,
      });
      const text = await body.text();
      if (statusCode === 200) {
        return JSON.parse(text);
      }
      console.warn(`[shinigami] ${url} returned ${statusCode}`);
      return JSON.parse(text);
    } catch {
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
      }
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

// --- Manga List (Latest, search, genre filter) ---
interface MangaListParams {
  page?: number;
  page_size?: number;
  sort?: string;
  sort_order?: string;
  q?: string;
  is_recommended?: boolean;
  genre?: string;
  format?: string;
  country_id?: string;
}

export async function getMangaList(params: MangaListParams = {}) {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page || 1));
  searchParams.set("page_size", String(params.page_size || 20));
  searchParams.set("sort", params.sort || "latest");
  searchParams.set("sort_order", params.sort_order || "desc");
  if (params.q) searchParams.set("q", params.q);
  if (params.is_recommended) searchParams.set("is_recommended", "true");
  if (params.genre) searchParams.set("genre", params.genre);
  if (params.format) searchParams.set("format", params.format);
  if (params.country_id) searchParams.set("country_id", params.country_id);

  return fetchWithRetry(`${API_BASE}/manga/list?${searchParams.toString()}`);
}

// --- Manga Top (Popular) ---
export async function getMangaTop(page = 1, pageSize = 20) {
  const searchParams = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  return fetchWithRetry(`${API_BASE}/manga/top?${searchParams.toString()}`);
}

// --- Manga Detail ---
export async function getMangaDetail(mangaId: string) {
  return fetchWithRetry(`${API_BASE}/manga/detail/${mangaId}`);
}

// --- Chapter List ---
export async function getChapterList(
  mangaId: string,
  page = 1,
  pageSize = 500,
  sortOrder = "desc"
) {
  const searchParams = new URLSearchParams({
    sort_by: "chapter_number",
    sort_order: sortOrder,
    page: String(page),
    page_size: String(pageSize),
  });
  return fetchWithRetry(
    `${API_BASE}/chapter/${mangaId}/list?${searchParams.toString()}`
  );
}

// --- Chapter Detail (for reading images) ---
export async function getChapterDetail(chapterId: string) {
  return fetchWithRetry(`${API_BASE}/chapter/detail/${chapterId}`);
}

// --- Genre List ---
export async function getGenreList() {
  return fetchWithRetry(`${API_BASE}/genre/list`);
}

// --- Type/Format List ---
export async function getFormatList() {
  return fetchWithRetry(`${API_BASE}/format/list?page=1`);
}
