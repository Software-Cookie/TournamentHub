"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SportIcon } from "@/components/sport-icon";

const STATUS = [
  ["", "All"],
  ["upcoming", "Upcoming"],
  ["ongoing", "Ongoing"],
  ["completed", "Completed"],
] as const;
const FORMAT = [
  ["", "Any format"],
  ["singles", "Singles"],
  ["doubles", "Doubles"],
  ["mixed", "Mixed doubles"],
  ["team", "Team sports"],
] as const;

export function TournamentFilters({ sports }: { sports: { slug: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [more, setMore] = useState(Boolean(params.get("city") || params.get("from") || params.get("to") || params.get("maxFee") || params.get("sport")));

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) set({ q });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["q", "sport", "city", "from", "to", "maxFee", "format", "status", "premium"].filter((k) => params.get(k)).length;

  return (
    <div className="card -mt-8 p-3 sm:p-4">
      <div className="scrollbar-none -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Sport">
        {[{ slug: "", name: "All sports" }, ...sports].map((sp) => {
          const on = (params.get("sport") ?? "") === sp.slug;
          return (
            <button key={sp.slug || "all"} role="tab" aria-selected={on} onClick={() => set({ sport: sp.slug })} className={cn("flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors", on ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:border-brand/40 hover:text-ink")}>
              {sp.slug && <SportIcon sport={sp.slug} className="size-4" />}
              {sp.name}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tournaments by name…" className="input h-12 pl-10" aria-label="Search tournaments" />
          {pending && <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-brand" />}
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-canvas p-1" role="tablist" aria-label="Status">
          {STATUS.map(([v, l]) => (
            <button key={v} role="tab" aria-selected={(params.get("status") ?? "") === v} onClick={() => set({ status: v })} className={cn("whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition", (params.get("status") ?? "") === v ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={params.get("format") ?? ""} onChange={(e) => set({ format: e.target.value })} className="input h-12 w-auto" aria-label="Format">
            {FORMAT.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select value={params.get("sort") ?? ""} onChange={(e) => set({ sort: e.target.value })} className="input h-12 w-auto" aria-label="Sort by">
            <option value="">Upcoming first</option>
            <option value="newest">Newest</option>
            <option value="fee">Lowest fee</option>
            <option value="prize">Highest prize</option>
          </select>
          <button onClick={() => setMore((m) => !m)} className={cn("relative grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-white hover:bg-canvas", more && "border-brand text-brand")} aria-label="More filters" aria-expanded={more}>
            <SlidersHorizontal className="size-4" />
            {active > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-accent text-[0.65rem] font-bold text-white">{active}</span>}
          </button>
        </div>
      </div>
      {more && (
        <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <select value={params.get("sport") ?? ""} onChange={(e) => set({ sport: e.target.value })} className="input" aria-label="Sport">
            <option value="">All sports</option>
            {sports.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <input defaultValue={params.get("city") ?? ""} onBlur={(e) => set({ city: e.target.value.trim() })} onKeyDown={(e) => e.key === "Enter" && set({ city: (e.target as HTMLInputElement).value.trim() })} placeholder="City / location" className="input" aria-label="Location" />
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-subtle">From</span>
            <input type="date" defaultValue={params.get("from") ?? ""} onChange={(e) => set({ from: e.target.value })} className="input" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-subtle">To</span>
            <input type="date" defaultValue={params.get("to") ?? ""} onChange={(e) => set({ to: e.target.value })} className="input" />
          </label>
          <select value={params.get("maxFee") ?? ""} onChange={(e) => set({ maxFee: e.target.value })} className="input" aria-label="Maximum fee">
            <option value="">Any fee</option>
            <option value="0">Free</option>
            <option value="500">Up to ₹500</option>
            <option value="1000">Up to ₹1,000</option>
            <option value="2000">Up to ₹2,000</option>
            <option value="5000">Up to ₹5,000</option>
          </select>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={params.get("premium") === "1"} onChange={(e) => set({ premium: e.target.checked ? "1" : "" })} className="size-4 accent-brand" />
            Premium events only
          </label>
          {active > 0 && (
            <button onClick={() => { setQ(""); start(() => router.replace(pathname, { scroll: false })); }} className="flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline sm:col-span-2 lg:col-span-5">
              <X className="size-4" /> Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
