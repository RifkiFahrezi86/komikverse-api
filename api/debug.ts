import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const results: Record<string, string> = {};

  // Test 1: @neondatabase/serverless
  try {
    const neonMod = await import("@neondatabase/serverless");
    results["@neondatabase/serverless"] = `OK - exports: ${Object.keys(neonMod).join(", ")}`;
  } catch (e) {
    results["@neondatabase/serverless"] = `FAIL - ${e}`;
  }

  // Test 2: bcryptjs
  try {
    const bcryptMod = await import("bcryptjs");
    results["bcryptjs"] = `OK - exports: ${Object.keys(bcryptMod).join(", ")}`;
  } catch (e) {
    results["bcryptjs"] = `FAIL - ${e}`;
  }

  // Test 3: jsonwebtoken
  try {
    const jwtMod = await import("jsonwebtoken");
    results["jsonwebtoken"] = `OK - exports: ${Object.keys(jwtMod).join(", ")}`;
  } catch (e) {
    results["jsonwebtoken"] = `FAIL - ${e}`;
  }

  // Test 4: env vars
  const envCheck: Record<string, boolean> = {
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    DATABASE_URL: !!process.env.DATABASE_URL,
    POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
    DATABASE_URL_UNPOOLED: !!process.env.DATABASE_URL_UNPOOLED,
    POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
    JWT_SECRET: !!process.env.JWT_SECRET,
    MIGRATION_SECRET: !!process.env.MIGRATION_SECRET,
  };

  // Test 5: db connection
  try {
    const { query } = await import("./lib/db");
    const r = await query("SELECT 1 as test");
    results["db_connection"] = `OK - ${JSON.stringify(r)}`;
  } catch (e) {
    results["db_connection"] = `FAIL - ${e}`;
  }

  return res.status(200).json({ imports: results, env: envCheck });
}
