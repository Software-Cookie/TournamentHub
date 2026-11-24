import "server-only";
import { db } from "@/lib/db";
import { entryInclude, entryName, entryPlayers } from "@/server/fixtures";
import { formatDateTime } from "@/lib/utils";
import type { BracketRound, BracketSide } from "@/components/bracket/bracket-view";

type Entry = Parameters<typeof entryName>[0] & { id: string; seed: number | null };

function side(e: Entry | null | undefined): BracketSide | null {
  if (!e) return null;
  const isTeam = Boolean(e.team);
  return { id: e.id, name: entryName(e), sub: isTeam ? entryPlayers(e) : null, seed: e.seed };
}

/** Bracket data for one category, shaped for <BracketView/>. */
export async function categoryBracket(categoryId: string) {
  const [category, rounds] = await Promise.all([
    db.tournamentCategory.findUnique({ where: { id: categoryId } }),
    db.matchRound.findMany({
      where: { categoryId },
      orderBy: [{ isThirdPlace: "asc" }, { number: "asc" }],
      include: {
        matches: {
          orderBy: { position: "asc" },
          include: { entryA: { include: entryInclude }, entryB: { include: entryInclude }, result: true },
        },
      },
    }),
  ]);
  let championName: string | null = null;
  if (category?.championId) {
    const c = await db.registration.findUnique({ where: { id: category.championId }, include: entryInclude });
    championName = c ? entryName(c) : null;
  }
  const data: BracketRound[] = rounds.map((r) => ({
    id: r.id,
    name: r.name,
    isThirdPlace: r.isThirdPlace,
    matches: r.matches.map((m) => ({
      id: m.id,
      position: m.position,
      a: side(m.entryA),
      b: side(m.entryB),
      winnerId: m.winnerId,
      status: m.status,
      score: m.result?.score ?? m.liveScore,
      court: m.court,
      time: m.scheduledAt ? formatDateTime(m.scheduledAt) : null,
      isBye: m.isBye,
    })),
  }));
  return { rounds: data, championName, category };
}
