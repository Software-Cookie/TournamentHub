import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarSearch } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { TournamentFilters } from "@/components/site/tournament-filters";
import { TournamentCard, TournamentCardSkeleton } from "@/components/tournament-card";
import { EmptyState } from "@/components/ui";
import { db } from "@/lib/db";
import { listPublicTournaments, type TournamentFilters as F } from "@/server/queries/tournaments";

export const metadata: Metadata = { title: "Tournaments", description: "Browse upcoming, ongoing and completed sports tournaments." };

type SP = Promise<Record<string, string | string[] | undefined>>;

function parse(sp: Record<string, string | string[] | undefined>): F {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 80) : undefined);
  const oneOf = <T extends string>(k: string, list: readonly T[]) => (list.includes(s(k) as T) ? (s(k) as T) : undefined);
  const fee = s("maxFee");
  return {
    q: s("q"),
    sport: s("sport"),
    city: s("city"),
    from: /^\d{4}-\d{2}-\d{2}$/.test(s("from") ?? "") ? s("from") : undefined,
    to: /^\d{4}-\d{2}-\d{2}$/.test(s("to") ?? "") ? s("to") : undefined,
    maxFee: fee && /^\d+$/.test(fee) ? Number(fee) * 100 : undefined,
    premium: s("premium") === "1" || undefined,
    format: oneOf("format", ["singles", "doubles", "mixed", "team"] as const),
    status: oneOf("status", ["upcoming", "ongoing", "completed"] as const),
    sort: oneOf("sort", ["newest", "upcoming", "fee", "prize"] as const),
  };
}

export default async function TournamentsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const sports = await db.sport.findMany({ where: { isActive: true, slug: { not: "other" } }, select: { slug: true, name: true }, orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHero eyebrow="Tournaments" title="Find your next tournament">
        Every sport, every city. Search by date, format and fee — slot counts are live.
      </PageHero>
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <Suspense>
          <TournamentFilters sports={sports} />
        </Suspense>
        <Suspense key={JSON.stringify(sp)} fallback={<GridSkeleton />}>
          <Results filters={parse(sp)} />
        </Suspense>
      </div>
    </>
  );
}

async function Results({ filters }: { filters: F }) {
  const list = await listPublicTournaments(filters);
  if (!list.length)
    return (
      <div className="mt-10">
        <EmptyState icon={<CalendarSearch className="size-6" />} title="No tournaments match those filters">
          Try widening your dates or clearing a filter.
        </EmptyState>
      </div>
    );
  return (
    <>
      <p className="mb-4 mt-8 text-sm font-medium text-muted">
        {list.length} tournament{list.length === 1 ? "" : "s"}
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t, i) => (
          <TournamentCard key={t.id} t={t} priority={i < 3} />
        ))}
      </div>
    </>
  );
}

function GridSkeleton() {
  return (
    <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <TournamentCardSkeleton key={i} />
      ))}
    </div>
  );
}
