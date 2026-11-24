"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Crown, MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type BracketSide = { id: string | null; name: string; sub?: string | null; seed?: number | null };
export type BracketMatch = {
  id: string;
  position: number;
  a: BracketSide | null;
  b: BracketSide | null;
  winnerId: string | null;
  status: string;
  score?: string | null;
  court?: string | null;
  time?: string | null;
  isBye: boolean;
};
export type BracketRound = { id: string; name: string; isThirdPlace: boolean; matches: BracketMatch[] };

const SLOT = 104; // px per first-round match slot

export function BracketView({ rounds, highlightIds = [], onMatchClick, championName }: { rounds: BracketRound[]; highlightIds?: string[]; onMatchClick?: (m: BracketMatch) => void; championName?: string | null }) {
  const [hover, setHover] = useState<string | null>(null);
  const main = rounds.filter((r) => !r.isThirdPlace);
  const third = rounds.find((r) => r.isThirdPlace);
  if (!main.length) return null;
  const firstCount = main[0]!.matches.length;
  const height = Math.max(firstCount * SLOT, 2 * SLOT);
  const focus = hover ?? null;

  return (
    <div className="overflow-x-auto pb-4 [scrollbar-width:thin]">
      <div className="flex min-w-max gap-0">
        {main.map((r, ri) => (
          <div key={r.id} className="w-[250px] shrink-0">
            <div className="sticky top-0 z-10 mb-3 px-3">
              <p className="eyebrow text-[0.68rem] text-subtle">Round {ri + 1}</p>
              <p className="font-extrabold">{r.name}</p>
            </div>
            <div className="relative flex flex-col" style={{ height }}>
              {r.matches.map((m, mi) => (
                <div key={m.id} className="relative flex items-center px-3" style={{ height: height / r.matches.length }}>
                  {/* connectors */}
                  {ri < main.length - 1 && (
                    <>
                      <span className="absolute right-0 top-1/2 h-px w-3 bg-line" aria-hidden />
                      <span
                        className={cn("absolute right-0 w-px bg-line", mi % 2 === 0 ? "top-1/2" : "bottom-1/2")}
                        style={{ height: height / r.matches.length / 2 }}
                        aria-hidden
                      />
                    </>
                  )}
                  {ri > 0 && <span className="absolute left-0 top-1/2 h-px w-3 bg-line" aria-hidden />}
                  <MatchCard m={m} highlightIds={highlightIds} focus={focus} setHover={setHover} onClick={onMatchClick} delay={ri * 0.06 + mi * 0.02} />
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Champion column */}
        <div className="w-[220px] shrink-0">
          <div className="mb-3 px-3">
            <p className="eyebrow text-[0.68rem] text-subtle">Winner</p>
            <p className="font-extrabold">Champion</p>
          </div>
          <div className="flex items-center px-3" style={{ height }}>
            <div className={cn("relative w-full overflow-hidden rounded-2xl border-2 p-4 text-center", championName ? "border-amber-400 bg-gradient-to-br from-amber-50 to-white" : "border-dashed border-line bg-white")}>
              <Crown className={cn("mx-auto size-7", championName ? "text-amber-500" : "text-line")} />
              <p className={cn("mt-2 font-extrabold", !championName && "text-subtle")}>{championName ?? "To be decided"}</p>
            </div>
          </div>
        </div>
      </div>
      {third && third.matches[0] && (
        <div className="mt-6 max-w-[260px] px-3">
          <p className="mb-2 font-extrabold">{third.name}</p>
          <MatchCard m={third.matches[0]} highlightIds={highlightIds} focus={focus} setHover={setHover} onClick={onMatchClick} delay={0} />
        </div>
      )}
    </div>
  );
}

function MatchCard({ m, highlightIds, focus, setHover, onClick, delay }: { m: BracketMatch; highlightIds: string[]; focus: string | null; setHover: (id: string | null) => void; onClick?: (m: BracketMatch) => void; delay: number }) {
  const mine = [m.a?.id, m.b?.id].some((id) => id && highlightIds.includes(id));
  const live = m.status === "ONGOING";
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick ? () => onClick(m) : undefined}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border bg-white text-left text-sm shadow-sm transition",
        mine ? "border-brand ring-2 ring-brand/20" : "border-line",
        live && "border-red-300 ring-2 ring-red-200",
        onClick && "hover:-translate-y-0.5 hover:shadow-md",
        m.isBye && "opacity-70",
      )}
    >
      {[m.a, m.b].map((s, i) => {
        const won = !!s?.id && m.winnerId === s.id;
        const lost = !!m.winnerId && !!s?.id && !won;
        return (
          <div
            key={i}
            onMouseEnter={() => s?.id && setHover(s.id)}
            onMouseLeave={() => setHover(null)}
            className={cn("flex items-center gap-2 px-3 py-2", i === 0 && "border-b border-line", won && "bg-green-50/70", s?.id && focus === s.id && "bg-brand-50")}
          >
            {s?.seed ? <span className="grid size-5 shrink-0 place-items-center rounded bg-navy text-[0.6rem] font-bold text-white">{s.seed}</span> : null}
            <div className="min-w-0 flex-1">
              <p className={cn("truncate font-semibold", !s && "italic text-subtle", lost && "text-subtle line-through decoration-1", won && "font-extrabold")}>{s ? s.name : m.isBye ? "BYE" : "TBD"}</p>
              {s?.sub && <p className="truncate text-[0.7rem] text-subtle">{s.sub}</p>}
            </div>
            {won && <span className="text-[0.65rem] font-bold uppercase text-success">Won</span>}
          </div>
        );
      })}
      {(m.score || m.court || m.time || live) && !m.isBye && (
        <div className="flex items-center gap-2 border-t border-line bg-canvas px-3 py-1.5 text-[0.7rem] text-muted">
          {live && <span className="flex items-center gap-1 font-bold text-danger"><span className="size-1.5 animate-pulse rounded-full bg-danger" /> LIVE</span>}
          {m.score && <span className="truncate font-mono font-semibold text-ink">{m.score}</span>}
          {!m.score && m.time && <span className="flex items-center gap-1"><Clock className="size-3" />{m.time}</span>}
          {m.court && <span className="ml-auto flex items-center gap-1"><MapPin className="size-3" />{m.court}</span>}
        </div>
      )}
    </Comp>
  );
}
