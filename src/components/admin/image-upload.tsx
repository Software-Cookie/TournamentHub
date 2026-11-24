"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export async function uploadFile(file: File, folder = "tournaments") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data as { url: string; publicId: string | null };
}

/** Single-image field: uploads immediately and stores the URL in a hidden input. */
export function ImageField({ name, defaultValue, label, aspect = "aspect-[16/7]", folder }: { name: string; defaultValue?: string | null; label: string; aspect?: string; folder?: string }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className={cn("relative overflow-hidden rounded-xl border-2 border-dashed border-line bg-canvas", aspect)}>
        {url ? (
          <>
            <Image src={url} alt="" fill sizes="600px" className="object-cover" />
            <button type="button" onClick={() => setUrl("")} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-navy/70 text-white hover:bg-navy" aria-label="Remove image">
              <X className="size-4" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-sm font-semibold text-muted hover:text-brand" disabled={busy}>
            {busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
            {busy ? "Uploading…" : "Upload image (JPG/PNG/WebP, max 5 MB)"}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            const r = await uploadFile(f, folder);
            setUrl(r.url);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
