import { neon } from "@neondatabase/serverless";

// Support semua nama variabel yang bisa dipakai Vercel/Neon integration
const DATABASE_URL =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

export function getDb() {
  if (!DATABASE_URL) throw new Error("Database not configured");
  return neon(DATABASE_URL);
}

export async function query(sql: string, params: unknown[] = []) {
  const db = getDb();
  return db(sql, params);
}
