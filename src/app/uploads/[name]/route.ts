import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

/**
 * Serves images saved by the local-disk upload fallback (development / demo only — production uses Cloudinary).
 * `next start` only serves files that existed in /public at build time, hence this handler.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!env.localUploads) return new NextResponse("Not found", { status: 404 });
  const { name } = await params;
  const m = /^([A-Za-z0-9_-]{8,40})\.(jpg|png|webp|gif)$/.exec(name);
  if (!m) return new NextResponse("Not found", { status: 404 });
  try {
    const file = await fs.readFile(path.join(process.cwd(), "public", "uploads", name));
    return new NextResponse(file, { headers: { "Content-Type": TYPES[m[2]!]!, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
