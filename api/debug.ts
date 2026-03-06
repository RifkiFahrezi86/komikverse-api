import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const results: Record<string, string> = {};
  const envCheck: Record<string, boolean> = {};

  // Test env vars
  const envNames = [
    "POSTGRES_URL", "DATABASE_URL", "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED", "POSTGRES_PRISMA_URL",
    "JWT_SECRET", "MIGRATION_SECRET"
  ];
  for (const name of envNames) {
    envCheck[name] = !!process.env[name];
  }

  // Test imports one by one
  try {
    await import("@neondatabase/serverless");
    results["neon"] = "OK";
  } catch (e: any) {
    results["neon"] = `FAIL: ${e.message}`;
  }

  try {
    await import("bcryptjs");
    results["bcryptjs"] = "OK";
  } catch (e: any) {
    results["bcryptjs"] = `FAIL: ${e.message}`;
  }

  try {
    await import("jsonwebtoken");
    results["jsonwebtoken"] = "OK";
  } catch (e: any) {
    results["jsonwebtoken"] = `FAIL: ${e.message}`;
  }

  // Test DB connection
  try {
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL ||
      process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_PRISMA_URL || "";
    if (!dbUrl) {
      results["db"] = "FAIL: No database URL found";
    } else {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(dbUrl);
      const r = await sql`SELECT 1 as ok`;
      results["db"] = `OK: ${JSON.stringify(r)}`;
    }
  } catch (e: any) {
    results["db"] = `FAIL: ${e.message}`;
  }

  return res.status(200).json({ node: process.version, imports: results, env: envCheck });
}
