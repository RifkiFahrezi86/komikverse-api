import type { VercelRequest, VercelResponse } from "@vercel/node";
import { query as dbQuery } from "./lib/db";

let _query: typeof dbQuery;

async function loadDb() {
  if (!_query) {
    _query = dbQuery;
  }
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (ALLOWED_ORIGINS.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  await loadDb();

  try {
    // Check if ads are globally enabled
    const settingsRows = await _query("SELECT value FROM site_settings WHERE key = 'ads_enabled'");
    const adsEnabled = settingsRows.length > 0 && settingsRows[0].value === "true";

    if (!adsEnabled) {
      return res.status(200).json({ ads: {} });
    }

    const rows = await _query(
      "SELECT slot_name, ad_code FROM ad_placements WHERE is_active = true AND ad_code != ''"
    );

    const ads: Record<string, string> = {};
    for (const row of rows) {
      ads[row.slot_name] = row.ad_code;
    }

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({ ads });
  } catch (error) {
    console.error("Ads error:", error);
    return res.status(200).json({ ads: {} }); // Fail silently for ads
  }
}
