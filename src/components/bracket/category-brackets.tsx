"use client";

import { useState } from "react";
import { BracketView, type BracketRound } from "@/components/bracket/bracket-view";
import { EmptyState } from "@/components/ui";
import { Swords } from "lucide-react";
import { cn } from "@/lib/utils";

export function CategoryBrackets({ categories, highlightIds }: { categories: { id: string; name: string; rounds: BracketRound[]; championName: string | null }[]; highlightIds: string[] }) {
  const initial = categories.find((c) => c.rounds.some((r) => r.matches.some((m) => [m.a?.id, m.b?.id].some((id) => id && highlightIds.includes(id))))) ?? categories[0];
  const [active, setActive] = useState(initial?.id);
  const cat = categories.find((c) => c.id === active);
  return (
    <div>
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {categories.map((c) => (
          <button key={c.id} role="tab" aria-selected={c.id === active} onClick={() => setActive(c.id)} className={cn("whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition", c.id === active ? "bg-navy text-white" : "bg-white text-muted ring-1 ring-line hover:text-ink")}>
            {c.name}
          </button>
        ))}
      </div>
      {cat && cat.rounds.length ? (
        <div className="card p-4 sm:p-6">
          <BracketView rounds={cat.rounds} highlightIds={highlightIds} championName={cat.championName} />
          {highlightIds.length > 0 && <p className="mt-3 text-xs text-subtle"><span className="mr-1 inline-block size-2.5 rounded-sm bg-brand align-middle" /> Highlighted: your matches</p>}
        </div>
      ) : (
        <EmptyState icon={<Swords className="size-6" />} title="Fixtures not published yet">
          The draw for this category hasn&apos;t been made. You&apos;ll get an email when your first match is scheduled.
        </EmptyState>
      )}
    </div>
  );
}
