// Shared Database Helper — used by all API route files
// Uses neon() .query() pattern: sql.query(text, params)

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

let _sql: any;

async function getSql() {
  if (!_sql) {
    const url = getDatabaseUrl();
    if (!url) throw new Error("Database not configured");
    const mod = await import("@neondatabase/serverless");
    const neon = (mod as any).neon || (mod as any).default?.neon;
    _sql = neon(url);
  }
  return _sql;
}

export async function query(text: string, params: unknown[] = []) {
  const sql = await getSql();
  return sql.query(text, params);
}
