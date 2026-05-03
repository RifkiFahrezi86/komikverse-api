import type { VercelRequest, VercelResponse } from "@vercel/node";

let _query: ((text: string, params?: unknown[]) => Promise<any[]>) | null = null;
let publicAdsCache:
  | {
      expiresAt: number;
      payload: {
        ads_enabled: boolean;
        ads: Record<string, string>;
        disabled_slots: string[];
        managed_slots: string[];
        generated_at: string;
      };
    }
  | null = null;
let publicAdsInflight:
  | Promise<{
      ads_enabled: boolean;
      ads: Record<string, string>;
      disabled_slots: string[];
      managed_slots: string[];
      generated_at: string;
    }>
  | null = null;

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
const PUBLIC_ADS_TTL = 60 * 1000;
const LEGACY_SLOT_ALIASES: Record<string, string> = {
  "home-top": "home-bottom-3",
  "home-mid": "home-bottom-4",
};

function normalizeSlotName(slot: string): string {
  return LEGACY_SLOT_ALIASES[slot] || slot;
}

async function loadQuery() {
  if (_query) return;

  const neonMod = await import("@neondatabase/serverless");
  const neon = (neonMod as any).neon || (neonMod as any).default?.neon;
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_PRISMA_URL || "";
  if (!url) throw new Error("Database not configured");

  const sql = neon(url);
  _query = (text: string, params: unknown[] = []) => sql.query(text, params);
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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

async function buildPublicAdsPayload() {
  if (!_query) throw new Error("Database query helper not initialized");

  const [settingsRows, adRows] = await Promise.all([
    _query("SELECT value FROM site_settings WHERE key = 'ads_enabled' LIMIT 1"),
    _query(
      "SELECT slot_name, ad_code, is_active FROM ad_placements ORDER BY id"
    ),
  ]);

  const adsEnabled = settingsRows[0]?.value !== "false";
  const ads: Record<string, string> = {};
  const disabledSlots = new Set<string>();
  const managedSlots = new Set<string>();
  for (const row of adRows) {
    const slotName = normalizeSlotName(String(row.slot_name || "").trim());
    const adCode = String(row.ad_code || "");
    if (!slotName) continue;

    managedSlots.add(slotName);

    if (row.is_active === false) {
      disabledSlots.add(slotName);
      continue;
    }

    if (!adCode) continue;
    ads[slotName] = adCode;
  }

  return {
    ads_enabled: adsEnabled,
    ads,
    disabled_slots: Array.from(disabledSlots),
    managed_slots: Array.from(managedSlots),
    generated_at: new Date().toISOString(),
  };
}

async function getPublicAdsPayload() {
  if (publicAdsCache && publicAdsCache.expiresAt > Date.now()) {
    return publicAdsCache.payload;
  }

  if (publicAdsInflight) return publicAdsInflight;

  publicAdsInflight = buildPublicAdsPayload()
    .then((payload) => {
      publicAdsCache = {
        expiresAt: Date.now() + PUBLIC_ADS_TTL,
        payload,
      };
      return payload;
    })
    .finally(() => {
      publicAdsInflight = null;
    });

  return publicAdsInflight;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    await loadQuery();
    const payload = await getPublicAdsPayload();

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=3600");
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Public ads error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}