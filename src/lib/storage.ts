import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { randomToken } from "@/lib/tokens";

const MAX_BYTES = 5 * 1024 * 1024;

/** Detect the real file type from magic bytes — never trust the client's MIME type or extension. */
function sniff(buf: Buffer): "jpg" | "png" | "webp" | "gif" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(0, 6).toString("ascii").startsWith("GIF8")) return "gif";
  return null;
}

export class UploadError extends Error {}

export async function uploadImage(file: File, folder = "tournaments") {
  if (file.size > MAX_BYTES) throw new UploadError("Images must be 5 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new UploadError("Only JPG, PNG, WebP or GIF images are allowed.");

  if (env.cloudinary.configured) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const fullFolder = `tournamenthub/${folder}`;
    const toSign = `folder=${fullFolder}&timestamp=${timestamp}${env.cloudinary.apiSecret}`;
    const signature = crypto.createHash("sha1").update(toSign).digest("hex");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)]), `upload.${ext}`);
    form.append("api_key", env.cloudinary.apiKey);
    form.append("timestamp", timestamp);
    form.append("folder", fullFolder);
    form.append("signature", signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/image/upload`, { method: "POST", body: form });
    const data = (await res.json()) as { secure_url?: string; public_id?: string; width?: number; height?: number; error?: { message: string } };
    if (!res.ok || !data.secure_url) throw new UploadError(data.error?.message ?? "Upload failed.");
    // f_auto,q_auto → Cloudinary serves optimised AVIF/WebP at the right quality.
    const url = data.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");
    return { url, publicId: data.public_id ?? null, width: data.width ?? null, height: data.height ?? null };
  }

  if (!env.localUploads) throw new UploadError("Image storage is not configured (set CLOUDINARY_* env vars).");
  // Development fallback.
  const name = `${randomToken(12)}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buf);
  return { url: `/uploads/${name}`, publicId: null, width: null, height: null };
}
