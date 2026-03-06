import { Router, Request, Response } from "express";
import {
  getMangaList,
  getMangaTop,
  getMangaDetail,
  getChapterList,
  getChapterDetail,
  getGenreList,
} from "./scrapers/shinigami.js";
import {
  transformComic,
  transformComicDetail,
  transformChapters,
  transformChapterData,
  transformGenres,
  transformPagination,
} from "./transformers.js";
import { getCache, setCache } from "./cache.js";

const router = Router();

// Helper to create standard API response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function apiResponse(data: any, pagination?: any) {
  return {
    status: "success",
    data,
    ...pagination,
  };
}

function apiError(message: string, statusCode = 500) {
  return { status: "error", message, code: statusCode };
}

// GET /terbaru - Latest comics
router.get("/terbaru", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const cacheKey = `latest_${page}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getMangaList({
      page,
      page_size: 20,
      sort: "latest",
      sort_order: "desc",
    });

    if (result.retcode !== 0) {
      return res.status(500).json(apiError("Failed to fetch latest comics"));
    }

    const comics = (result.data || []).map(transformComic);
    const pagination = transformPagination(result.meta);
    const response = apiResponse(comics, pagination);
    setCache(cacheKey, response, 5);
    res.json(response);
  } catch (error) {
    console.error("[/terbaru]", error);
    res.status(500).json(apiError("Failed to fetch latest comics"));
  }
});

// GET /popular - Popular comics
router.get("/popular", async (_req: Request, res: Response) => {
  try {
    const cacheKey = "popular";
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getMangaTop(1, 30);

    if (result.retcode !== 0) {
      return res.status(500).json(apiError("Failed to fetch popular comics"));
    }

    const comics = (result.data || []).map(transformComic);
    const response = apiResponse(comics);
    setCache(cacheKey, response, 15);
    res.json(response);
  } catch (error) {
    console.error("[/popular]", error);
    res.status(500).json(apiError("Failed to fetch popular comics"));
  }
});

// GET /recommended - Recommended comics
router.get("/recommended", async (_req: Request, res: Response) => {
  try {
    const cacheKey = "recommended";
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getMangaList({
      page: 1,
      page_size: 30,
      sort: "latest",
      sort_order: "desc",
      is_recommended: true,
    });

    if (result.retcode !== 0) {
      return res.status(500).json(apiError("Failed to fetch recommended comics"));
    }

    const comics = (result.data || []).map(transformComic);
    const response = apiResponse(comics);
    setCache(cacheKey, response, 15);
    res.json(response);
  } catch (error) {
    console.error("[/recommended]", error);
    res.status(500).json(apiError("Failed to fetch recommended comics"));
  }
});

// GET /search - Search comics
router.get("/search", async (req: Request, res: Response) => {
  try {
    const keyword = req.query.keyword as string;
    if (!keyword) {
      return res.status(400).json(apiError("Parameter 'keyword' diperlukan", 400));
    }

    const cacheKey = `search_${keyword.toLowerCase()}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getMangaList({
      page: 1,
      page_size: 30,
      sort: "latest",
      sort_order: "desc",
      q: keyword,
    });

    if (result.retcode !== 0) {
      return res.status(500).json(apiError("Failed to search comics"));
    }

    const comics = (result.data || []).map(transformComic);
    const response = apiResponse(comics);
    setCache(cacheKey, response, 10);
    res.json(response);
  } catch (error) {
    console.error("[/search]", error);
    res.status(500).json(apiError("Failed to search comics"));
  }
});

// GET /detail/:slug - Comic detail
router.get("/detail/:slug", async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const cacheKey = `detail_${slug}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [detailResult, chapterResult]: any[] = await Promise.all([
      getMangaDetail(slug),
      getChapterList(slug, 1, 500, "desc"),
    ]);

    if (detailResult.retcode !== 0) {
      return res.status(404).json(apiError("Comic not found", 404));
    }

    const comic: any = transformComicDetail(detailResult.data);
    const chapters = chapterResult.retcode === 0
      ? transformChapters(chapterResult.data || [])
      : [];
    
    comic.chapters = chapters;

    const response = apiResponse(comic);
    setCache(cacheKey, response, 10);
    res.json(response);
  } catch (error) {
    console.error("[/detail]", error);
    res.status(500).json(apiError("Failed to fetch comic detail"));
  }
});

// GET /read/:slug - Chapter images for reading
router.get("/read/:slug", async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const cacheKey = `read_${slug}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getChapterDetail(slug);

    if (result.retcode !== 0) {
      return res.status(404).json(apiError("Chapter not found", 404));
    }

    const chapterData = transformChapterData(result.data);
    const response = apiResponse([chapterData]);
    setCache(cacheKey, response, 30);
    res.json(response);
  } catch (error) {
    console.error("[/read]", error);
    res.status(500).json(apiError("Failed to fetch chapter images"));
  }
});

// GET /genre - Genre list
router.get("/genre", async (_req: Request, res: Response) => {
  try {
    const cacheKey = "genres";
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getGenreList();

    if (result.retcode !== 0) {
      return res.status(500).json(apiError("Failed to fetch genres"));
    }

    const genres = transformGenres(result.data || []);
    const response = apiResponse(genres);
    setCache(cacheKey, response, 60);
    res.json(response);
  } catch (error) {
    console.error("[/genre]", error);
    res.status(500).json(apiError("Failed to fetch genres"));
  }
});

// GET /genre/:slug - Comics by genre
router.get("/genre/:slug", async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const page = parseInt(req.query.page as string) || 1;
    const cacheKey = `genre_${slug}_${page}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await getMangaList({
      page,
      page_size: 20,
      sort: "latest",
      sort_order: "desc",
      genre: slug,
    });

    if (result.retcode !== 0) {
      return res.status(500).json(apiError("Failed to fetch comics by genre"));
    }

    const comics = (result.data || []).map(transformComic);
    const pagination = transformPagination(result.meta);
    const response = apiResponse(comics, pagination);
    setCache(cacheKey, response, 10);
    res.json(response);
  } catch (error) {
    console.error("[/genre/:slug]", error);
    res.status(500).json(apiError("Failed to fetch comics by genre"));
  }
});

export default router;
