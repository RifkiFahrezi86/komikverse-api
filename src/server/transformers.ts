// Transforms shinigami API responses to the format expected by the KomikVerse frontend

interface ShinigamiManga {
  manga_id: string;
  title: string;
  description: string;
  alternative_title: string;
  release_year: string;
  status: number;
  cover_image_url: string;
  cover_portrait_url: string;
  view_count: number;
  user_rate: number;
  latest_chapter_id: string;
  latest_chapter_number: number;
  latest_chapter_time: string;
  country_id: string;
  bookmark_count: number;
  is_recommended: boolean;
  taxonomy: {
    Artist?: Array<{ name: string; slug: string }>;
    Author?: Array<{ name: string; slug: string }>;
    Format?: Array<{ name: string; slug: string }>;
    Genre?: Array<{ name: string; slug: string }>;
    Type?: Array<{ name: string; slug: string }>;
  };
  created_at: string;
  updated_at: string;
}

interface ShinigamiChapter {
  chapter_id: string;
  manga_id: string;
  chapter_number: number;
  chapter_title: string;
  release_date: string;
  created_at: string;
}

interface ShinigamiChapterDetail {
  chapter_id: string;
  manga_id: string;
  chapter_number: number;
  chapter_title: string;
  base_url: string;
  base_url_low: string;
  chapter: {
    path: string;
    data: string[];
  };
  prev_chapter_id: string | null;
  prev_chapter_number: number | null;
  next_chapter_id: string | null;
  next_chapter_number: number | null;
  release_date: string;
}

function getTypeFromCountry(countryId: string): string {
  switch (countryId) {
    case "KR":
      return "Manhwa";
    case "CN":
      return "Manhua";
    case "JP":
      return "Manga";
    default:
      return "Manga";
  }
}

function getStatusText(status: number): string {
  switch (status) {
    case 1:
      return "Ongoing";
    case 2:
      return "Completed";
    case 3:
      return "Hiatus";
    default:
      return "Unknown";
  }
}

// Transform manga list item to Comic format
export function transformComic(manga: ShinigamiManga) {
  const format = manga.taxonomy?.Format?.[0]?.name;
  return {
    title: manga.title,
    thumbnail: manga.cover_image_url,
    image: manga.cover_image_url,
    href: `/manga/${manga.manga_id}`,
    type: format || getTypeFromCountry(manga.country_id),
    chapter: manga.latest_chapter_number
      ? `Chapter ${manga.latest_chapter_number}`
      : undefined,
    rating: manga.user_rate || undefined,
    description: manga.description,
    genre: manga.taxonomy?.Genre?.map((g) => g.name).join(", "),
    status: getStatusText(manga.status),
    author: manga.taxonomy?.Author?.map((a) => a.name).join(", "),
  };
}

// Transform manga detail to ComicDetail format
export function transformComicDetail(manga: ShinigamiManga) {
  return {
    title: manga.title,
    thumbnail: manga.cover_image_url,
    image: manga.cover_image_url,
    description: manga.description,
    type: manga.taxonomy?.Format?.[0]?.name || getTypeFromCountry(manga.country_id),
    status: getStatusText(manga.status),
    author: manga.taxonomy?.Author?.map((a) => a.name).join(", "),
    artist: manga.taxonomy?.Artist?.map((a) => a.name).join(", "),
    genre: manga.taxonomy?.Genre?.map((g) => ({
      title: g.name,
      href: `/genre/${g.slug}`,
    })) || [],
    rating: manga.user_rate || undefined,
    chapters: [], // Will be filled separately
    alternative: manga.alternative_title,
    released: manga.release_year,
  };
}

// Transform chapter list
export function transformChapters(chapters: ShinigamiChapter[]) {
  return chapters.map((ch) => ({
    title: ch.chapter_title || `Chapter ${ch.chapter_number}`,
    href: `/chapter/${ch.chapter_id}`,
    date: ch.release_date || ch.created_at,
    number: ch.chapter_number,
  }));
}

// Transform chapter detail for reading
export function transformChapterData(detail: ShinigamiChapterDetail) {
  const baseUrl = detail.base_url || "https://assets.shngm.id";
  const path = detail.chapter?.path || "";
  const panels = (detail.chapter?.data || []).map(
    (filename) => `${baseUrl}${path}${filename}`
  );

  return {
    title: detail.chapter_title || `Chapter ${detail.chapter_number}`,
    panel: panels,
    prev_chapter_id: detail.prev_chapter_id,
    next_chapter_id: detail.next_chapter_id,
    chapter_number: detail.chapter_number,
  };
}

// Transform genre list
export function transformGenres(
  genres: Array<{ taxonomy_id: number; slug: string; name: string }>
) {
  return genres.map((g) => ({
    title: g.name,
    href: `/genre/${g.slug}`,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformPagination(meta: any) {
  const page = meta?.page || 1;
  const totalPage = meta?.total_page || 1;
  return {
    current_page: page,
    length_page: totalPage,
    has_next: page < totalPage,
    has_prev: page > 1,
  };
}
