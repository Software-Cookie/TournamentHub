import { requireTournamentManager } from "@/lib/authz";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { toIstInput } from "@/lib/dates";
import { confirmedEntries, entryInclude, entryName, entryPlayers } from "@/server/fixtures";
import { categoryBracket } from "@/server/queries/bracket";
import { getSportDef } from "@/lib/sports";
import { FixtureManager } from "@/components/admin/fixture-manager";
import type { EditableMatch } from "@/components/admin/match-editor";

export const metadata = { title: "Category fixtures" };
export const dynamic = "force-dynamic";

export default async function CategoryFixturesPage({ params }: { params: Promise<{ id: string; categoryId: string }> }) {
  const { id, categoryId } = await params;
  await requireTournamentManager(id);
  const category = await db.tournamentCategory.findFirst({ where: { id: categoryId, tournamentId: id }, include: { tournament: { include: { sport: true } } } });
  if (!category) notFound();

  const [entries, bracket, matches] = await Promise.all([
    confirmedEntries(categoryId),
    categoryBracket(categoryId),
    db.match.findMany({
      where: { categoryId },
      include: { entryA: { include: entryInclude }, entryB: { include: entryInclude }, round: true, result: true },
      orderBy: [{ round: { isThirdPlace: "asc" } }, { round: { number: "asc" } }, { position: "asc" }],
    }),
  ]);
  const started = matches.some((m) => !m.isBye && (m.status === "ONGOING" || m.status === "COMPLETED"));
  const editable: EditableMatch[] = matches.map((m) => ({
    id: m.id,
    version: m.version,
    status: m.status,
    roundName: m.round.name,
    categoryName: category.name,
    a: m.entryA ? { id: m.entryA.id, name: entryName(m.entryA), sub: m.entryA.team ? entryPlayers(m.entryA) : null } : null,
    b: m.entryB ? { id: m.entryB.id, name: entryName(m.entryB), sub: m.entryB.team ? entryPlayers(m.entryB) : null } : null,
    winnerId: m.winnerId,
    court: m.court,
    scheduledAtInput: toIstInput(m.scheduledAt),
    notes: m.notes,
    liveScore: m.liveScore,
    score: m.result?.score ?? null,
    durationMinutes: m.result?.durationMinutes ?? null,
    remarks: m.result?.remarks ?? null,
    isBye: m.isBye,
  }));
  const firstRound = matches.filter((m) => m.round.number === 1 && !m.round.isThirdPlace).map((m) => [m.entryAId, m.entryBId] as [string | null, string | null]);

  return (
    <>
      <Link href={`/manage/tournaments/${id}/fixtures`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> All categories
      </Link>
      <FixtureManager
        categoryId={categoryId}
        categoryName={category.name}
        status={category.status}
        thirdPlace={category.thirdPlacePlayoff}
        isTeam={category.teamSize > 1}
        started={started}
        scoringHint={getSportDef(category.tournament.sport.slug)?.scoring.placeholder ?? "21-18, 21-15"}
        entries={entries.map((e) => ({
          id: e.id,
          code: e.code,
          name: entryName(e),
          team: e.team?.name ?? null,
          p1: e.participants[0]?.fullName ?? "",
          p2: e.participants[1]?.fullName ?? null,
          seed: e.seed,
          paymentStatus: e.amount === 0 ? "FREE" : (e.payments[0]?.status ?? "—"),
        }))}
        rounds={bracket.rounds}
        championName={bracket.championName}
        matches={editable}
        firstRound={firstRound}
      />
    </>
  );
}
