import "server-only";
import { db } from "@/lib/db";
import { myRegistrationWhere, type SessionUser } from "@/lib/authz";
import { entryInclude, entryName, entryPlayers } from "@/server/fixtures";

export async function myRegistrations(user: SessionUser) {
  return db.registration.findMany({
    where: await myRegistrationWhere(user),
    include: {
      tournament: { select: { id: true, name: true, slug: true, startDate: true, status: true, bannerUrl: true, venue: { select: { name: true, city: true } } } },
      category: { select: { name: true } },
      team: { select: { name: true } },
      ticket: { select: { number: true, revokedAt: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      participants: { select: { fullName: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: [{ tournament: { startDate: "desc" } }, { createdAt: "desc" }],
  });
}

export type MyMatch = Awaited<ReturnType<typeof myMatches>>[number];

/** Matches involving the user's CONFIRMED registrations — access is implied by ownership. */
export async function myMatches(user: SessionUser) {
  const regs = await db.registration.findMany({ where: { status: "CONFIRMED", ...(await myRegistrationWhere(user)) }, select: { id: true } });
  const ids = regs.map((r) => r.id);
  if (!ids.length) return [];
  const matches = await db.match.findMany({
    where: { isBye: false, OR: [{ entryAId: { in: ids } }, { entryBId: { in: ids } }] },
    include: {
      entryA: { include: entryInclude },
      entryB: { include: entryInclude },
      round: true,
      category: { select: { name: true } },
      tournament: { select: { name: true, slug: true, venue: { select: { name: true, city: true } } } },
      result: true,
    },
    orderBy: [{ scheduledAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
  const nextIds = matches.filter((m) => m.nextMatchId).map((m) => m.nextMatchId!);
  const nexts = await db.match.findMany({ where: { id: { in: nextIds } }, include: { round: { select: { name: true } } } });
  const nextRound = new Map(nexts.map((n) => [n.id, n.round.name]));

  return matches.map((m) => {
    const mineIsA = !!m.entryAId && ids.includes(m.entryAId);
    const me = mineIsA ? m.entryA : m.entryB;
    const opp = mineIsA ? m.entryB : m.entryA;
    return {
      id: m.id,
      status: m.status,
      tournament: m.tournament,
      category: m.category.name,
      round: m.round.name,
      court: m.court,
      scheduledAt: m.scheduledAt,
      liveScore: m.liveScore,
      score: m.result?.score ?? null,
      won: m.winnerId ? m.winnerId === me?.id : null,
      myName: me ? entryName(me) : "",
      opponent: opp ? entryName(opp) : "To be decided",
      opponentPlayers: opp && opp.team ? entryPlayers(opp) : null,
      nextRound: m.nextMatchId ? nextRound.get(m.nextMatchId) ?? null : null,
      notes: m.notes,
    };
  });
}
