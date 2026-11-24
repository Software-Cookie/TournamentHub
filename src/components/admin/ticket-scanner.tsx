"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Search } from "lucide-react";
import { Button, Card } from "@/components/ui";

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

function extractToken(raw: string) {
  const v = raw.trim();
  const m = v.match(/\/verify\/([A-Za-z0-9_-]+)/);
  if (m) return m[1]!;
  return v;
}

export function TicketScanner() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [supported, setSupported] = useState(true);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSupported(typeof window !== "undefined" && !!window.BarcodeDetector), []);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let stop = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
        const loop = async () => {
          if (stop || !video.current) return;
          try {
            const codes = await detector.detect(video.current);
            if (codes[0]?.rawValue) {
              stop = true;
              router.push(`/verify/${encodeURIComponent(extractToken(codes[0].rawValue))}`);
              return;
            }
          } catch {
            /* keep scanning */
          }
          setTimeout(loop, 250);
        };
        loop();
      } catch {
        setError("Camera unavailable. Allow camera access or enter the ticket number below.");
        setActive(false);
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, router]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <div className="relative aspect-square bg-navy sm:aspect-video">
          <video ref={video} className="absolute inset-0 size-full object-cover" muted playsInline />
          {!active && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-white/80">
              <div>
                <Camera className="mx-auto size-10" />
                <p className="mt-3 text-sm">{supported ? "Start the camera and point it at the ticket's QR code." : "This browser can't scan QR codes. Use a phone camera app (it opens the verify link) or enter the number."}</p>
              </div>
            </div>
          )}
          {active && <div className="pointer-events-none absolute inset-[18%] rounded-3xl border-4 border-accent/80 shadow-[0_0_0_9999px_rgba(16,24,40,.45)]" />}
        </div>
        <div className="flex items-center justify-between gap-3 p-4">
          {error ? <p className="text-sm text-danger">{error}</p> : <p className="text-sm text-muted">Works on Chrome/Edge (Android & desktop).</p>}
          {supported && (
            <Button variant={active ? "secondary" : "primary"} onClick={() => { setError(null); setActive((a) => !a); }}>
              {active ? <><CameraOff className="size-4" /> Stop</> : <><Camera className="size-4" /> Start camera</>}
            </Button>
          )}
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="font-extrabold">Manual lookup</h2>
        <p className="mt-1 text-sm text-muted">Enter the ticket number (TKT-…) or paste the verification link.</p>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) router.push(`/verify/${encodeURIComponent(extractToken(manual))}`); }}>
          <input className="input font-mono uppercase" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="TKT-2026-XXXXXXX" aria-label="Ticket number or link" />
          <Button type="submit"><Search className="size-4" /> Verify</Button>
        </form>
      </Card>
    </div>
  );
}
