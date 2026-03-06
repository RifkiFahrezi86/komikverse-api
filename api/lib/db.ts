// Support semua nama variabel yang bisa dipakai Vercel/Neon integration
function getDatabaseUrl() {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_PRISMA_URL ||
    ""
  );
}

let _neon: any;

async function getNeon() {
  if (!_neon) {
    const mod = await import("@neondatabase/serverless");
    _neon = (mod as any).neon || (mod as any).default?.neon || mod;
  }
  return _neon;
}

export async function getDb() {
  const url = getDatabaseUrl();
  if (!url) throw new Error("Database not configured");
  const neon = await getNeon();
  return neon(url);
}

export async function query(sql: string, params: unknown[] = []) {
  const db = await getDb();
  return db(sql, params);
}
