import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Fixed-window rate limiter backed by Postgres (consistent across serverless instances).
 * Returns true when the request is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowSeconds * 1000);
  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."windowStart" < ${cutoff} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${cutoff} THEN ${now} ELSE "RateLimit"."windowStart" END
      RETURNING "count"`;
    return (rows[0]?.count ?? 0) <= limit;
  } catch (e) {
    console.error("rateLimit check failed; allowing request", e);
    return true;
  }
}

export async function rateLimitByIp(scope: string, limit: number, windowSeconds: number) {
  return rateLimit(`${scope}:${await clientIp()}`, limit, windowSeconds);
}
