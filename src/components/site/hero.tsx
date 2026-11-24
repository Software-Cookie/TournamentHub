"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { preload } from "react-dom";
import { ArrowRight, Pause, Play, ShieldCheck, Ticket, Zap } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { SportIcon } from "@/components/sport-icon";
import { cn } from "@/lib/utils";

export type HeroClip = { src: string; poster: string; sport: string; label: string };

const FALLBACK_MS = 6500;

export function Hero({ clips }: { clips: HeroClip[] }) {
  preload(clips[0]?.poster ?? "", { as: "image", fetchPriority: "high" });
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const section = useRef<HTMLElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const inView = useRef(true);

  const next = useCallback(() => setActive((i) => (i + 1) % clips.length), [clips.length]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Play the active clip, pause the rest; fall back to a timer if autoplay is blocked.
  useEffect(() => {
    let timer = 0;
    videos.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) {
        v.currentTime = 0;
        if (!reduced && !paused && inView.current) {
          v.play().catch(() => {
            timer = window.setTimeout(next, FALLBACK_MS);
          });
        }
      } else {
        v.pause();
      }
    });
    if (reduced && !paused) timer = window.setTimeout(next, FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [active, reduced, paused, next]);

  // Progress line on the active chip (rAF only while playing).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videos.current[active];
      if (v && progress.current && v.duration) progress.current.style.transform = `scaleX(${Math.min(1, v.currentTime / v.duration)})`;
      raf = requestAnimationFrame(tick);
    };
    if (!reduced) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced]);

  // Pause when scrolled away or the tab is hidden.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      inView.current = !!e?.isIntersecting;
      const v = videos.current[active];
      if (!v) return;
      if (inView.current && !paused && !reduced) v.play().catch(() => {});
      else v.pause();
    });
    io.observe(el);
    const vis = () => {
      const v = videos.current[active];
      if (document.hidden) v?.pause();
      else if (inView.current && !paused && !reduced) v?.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, [active, paused, reduced]);

  const togglePause = () => {
    setPaused((p) => {
      const v = videos.current[active];
      if (p) v?.play().catch(() => {});
      else v?.pause();
      return !p;
    });
  };

  return (
    <section ref={section} className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-navy text-white" aria-label="Featured sports">
      {/* Clips */}
      <div className="absolute inset-0 -z-10" aria-hidden>
        {clips.map((c, i) => {
          const near = i === active || i === (active + 1) % clips.length;
          return (
            <video
              key={c.src}
              ref={(el) => {
                videos.current[i] = el;
              }}
              className={cn("absolute inset-0 size-full object-cover transition-opacity duration-1000 ease-out", i === active ? "opacity-100" : "opacity-0")}
              src={near ? c.src : undefined}
              poster={c.poster}
              muted
              playsInline
              preload={near ? "auto" : "none"}
              onEnded={() => i === active && !paused && next()}
            />
          );
        })}
        <div className="absolute inset-0 bg-[linear-gradient(95deg,rgb(3_11_37/0.9)_0%,rgb(3_11_37/0.6)_30%,rgb(3_11_37/0.08)_58%,rgb(3_11_37/0)_80%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-navy/90 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-navy/70 to-transparent" />
      </div>

      <div className="flex w-full flex-1 flex-col justify-center px-5 pb-10 pt-28 sm:px-8 lg:px-14 xl:px-20">
        <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-navy/60 px-3 py-1.5 text-xs font-semibold text-white/85">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          Entries open across {clips.length > 5 ? "10+" : "multiple"} sports
        </p>

        <h1 className="display max-w-4xl text-[3.2rem] italic drop-shadow-[0_4px_24px_rgb(3_11_37/0.6)] sm:text-7xl lg:text-[5.6rem] 2xl:text-[6.4rem]">
          <span className="block">Play your game.</span>
          <span className="block">
            Own your <span className="swoosh-underline pr-2 text-accent">moment.</span>
          </span>
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/85 sm:text-xl">
          Discover tournaments, challenge your limits, compete with passionate players, and become part of a growing sports community.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/tournaments" className={buttonClass("accent", "lg", "group h-14 px-8 text-base", true)}>
            <span className="inline-flex items-center gap-2.5">
              Explore Tournaments <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
          <Link href="/tournaments?status=upcoming" className={buttonClass("outline-light", "lg", "h-14 px-8 text-base", true)}>
            <span>Register for a Tournament</span>
          </Link>
        </div>
        <p className="mt-5 text-sm text-white/65">
          Organising an event?{" "}
          <Link href="/host" className="font-bold text-white underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-400">
            Host your tournament
          </Link>
        </p>

        <ul className="mt-10 hidden flex-wrap gap-x-7 gap-y-3 text-sm font-medium text-white/75 md:flex">
          <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-brand-400" /> Secure Razorpay payments</li>
          <li className="flex items-center gap-2"><Ticket className="size-4 text-brand-400" /> Instant QR tickets</li>
          <li className="flex items-center gap-2"><Zap className="size-4 text-brand-400" /> Live brackets & results</li>
        </ul>
      </div>

      {/* Sport selector = slide indicators */}
      <div className="relative w-full px-5 pb-8 sm:px-8 lg:px-14 xl:px-20">
        <div className="flex items-center gap-2">
          <div className="scrollbar-none -mx-1 flex flex-1 gap-2 overflow-x-auto px-1 py-1" role="tablist" aria-label="Sport clips">
            {clips.map((c, i) => (
              <button
                key={c.src}
                role="tab"
                aria-selected={i === active}
                aria-label={`Show ${c.label}`}
                onClick={() => setActive(i)}
                className={cn(
                  "slant relative shrink-0 overflow-hidden rounded-md border px-4 py-2.5 text-sm font-bold transition-colors",
                  i === active ? "border-white/40 bg-white text-navy" : "border-white/15 bg-navy/55 text-white/80 hover:border-white/40 hover:text-white",
                )}
              >
                <span className="flex items-center gap-2">
                  <SportIcon sport={c.sport} className="size-4" />
                  {c.label}
                </span>
                {i === active && !reduced && <span ref={progress} style={{ transform: "scaleX(0)" }} className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-gradient-to-r from-accent to-accent-400" />}
              </button>
            ))}
          </div>
          <button onClick={togglePause} className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20 bg-navy/55 text-white/80 transition-colors hover:text-white" aria-label={paused ? "Play videos" : "Pause videos"}>
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        </div>
      </div>
    </section>
  );
}
