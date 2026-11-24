import { manageScope, requireManager } from "@/lib/authz";
import { db } from "@/lib/db";
import { toIstInput } from "@/lib/dates";
import { entryInclude, entryName, entryPlayers } from "@/server/fixtures";
import { PageHeader } from "@/components/ui";
import { MatchControl, type ControlMatch } from "@/components/admin/match-control";

export const metadata = { title: "Match control" };
export const dynamic = "force-dynamic";

export default async function MatchControlPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const user = await requireManager("/manage/matches");
  const scope = await manageScope(user);
  const { t } = await searchParams;
  const tournaments = await db.tournament.findMany({
    where: { ...scope, matches: { some: {} }, status: { in: ["PUBLISHED", "ONGOING", "COMPLETED"] } },
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, status: true },
  });
  const active = tournaments.filter((x) => x.status !== "COMPLETED");
  const tournamentId = t && tournaments.some((x) => x.id === t) ? t : (active[0]?.id ?? tournaments[0]?.id);

  const matches = tournamentId
    ? await db.match.findMany({
        where: { tournamentId, isBye: false },
        include: { entryA: { include: entryInclude }, entryB: { include: entryInclude }, round: true, result: true, category: { select: { name: true } } },
        orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { round: { number: "asc" } }, { position: "asc" }],
      })
    : [];
  const data: ControlMatch[] = matches.map((m) => ({
    id: m.id,
    version: m.version,
    status: m.status,
    roundName: m.round.name,
    categoryName: m.category.name,
    a: m.entryA ? { id: m.entryA.id, name: entryName(m.entryA), sub: m.entryA.team ? entryPlayers(m.entryA) : null } : null,
    b: m.entryB ? { id: m.entryB.id, name: entryName(m.entryB), sub: m.entryB.team ? entryPlayers(m.entryB) : null } : null,
    winnerId: m.winnerId,
    court: m.court,
    scheduledAtInput: toIstInput(m.scheduledAt),
    scheduledAt: m.scheduledAt?.toISOString() ?? null,
    completedAt: m.completedAt?.toISOString() ?? null,
    notes: m.notes,
    liveScore: m.liveScore,
    score: m.result?.score ?? null,
    durationMinutes: m.result?.durationMinutes ?? null,
    remarks: m.result?.remarks ?? null,
    isBye: false,
  }));

  return (
    <>
      <PageHeader eyebrow="Live operations" title="Match control centre" description="Run every court from one screen. Updates refresh automatically every 20 seconds." />
      <MatchControl tournaments={tournaments.map((x) => ({ id: x.id, name: x.name }))} tournamentId={tournamentId ?? null} matches={data} />
    </>
  );
}
