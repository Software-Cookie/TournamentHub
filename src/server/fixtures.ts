import "server-only";
import { after } from "next/server";
import type { MatchStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { firstRoundPairs, planBracket, type DrawMode } from "@/lib/bracket";
import { sendEmail } from "@/lib/email/send";
import * as T from "@/lib/email/templates";
import { formatDateTime, mapsLink } from "@/lib/utils";
import type { SessionUser } from "@/lib/authz";

export class FixtureError extends Error {}

export const entryInclude = {
  team: true,
  participants: { select: { fullName: true, email: true }, orderBy: { createdAt: "asc" } },
  user: { select: { email: true, name: true } },
} satisfies Prisma.RegistrationInclude;
type EntryWithPeople = Prisma.RegistrationGetPayload<{ include: typeof entryInclude }>;

export function entryName(e: { team?: { name: string } | null; participants: { fullName: string }[] } | null | undefined) {
  if (!e) return "TBD";
  if (e.team) return e.team.name;
  return e.participants.map((p) => p.fullName).join(" / ") || "Unknown";
}

export function entryPlayers(e: { participants: { fullName: string }[] } | null | undefined) {
  return e?.participants.map((p) => p.fullName).join(" & ") ?? "";
}

function recipients(e: EntryWithPeople) {
  const map = new Map<string, string>();
  map.set(e.user.email.toLowerCase(), e.participants[0]?.fullName ?? e.user.name ?? "Player");
  for (const p of e.participants) if (p.email && !map.has(p.email.toLowerCase())) map.set(p.email.toLowerCase(), p.fullName);
  return map;
}

async function history(tx: Prisma.TransactionClient, matchId: string, action: string, actorId: string | null, before: unknown, after_: unknown) {
  await tx.matchHistory.create({
    data: { matchId, action, actorId, before: (before ?? undefined) as Prisma.InputJsonValue, after: (after_ ?? undefined) as Prisma.InputJsonValue },
  });
}

export async function confirmedEntries(categoryId: string) {
  return db.registration.findMany({
    where: { categoryId, status: "CONFIRMED" },
    include: { ...entryInclude, payments: { select: { status: true }, take: 1, orderBy: { createdAt: "desc" } } },
    orderBy: [{ seed: { sort: "asc", nulls: "last" } }, { confirmedAt: "asc" }],
  });
}

async function assertDrawEditable(tx: Prisma.TransactionClient, categoryId: string) {
  const started = await tx.match.count({
    where: { categoryId, isBye: false, OR: [{ status: { in: ["ONGOING", "COMPLETED"] } }, { result: { isNot: null } }] },
  });
  if (started > 0) throw new FixtureError("Matches in this category have already started. The draw can no longer be regenerated — use result corrections instead.");
}

async function writeBracket(tx: Prisma.TransactionClient, tournamentId: string, categoryId: string, plan: ReturnType<typeof planBracket>) {
  await tx.match.deleteMany({ where: { categoryId } });
  await tx.matchRound.deleteMany({ where: { categoryId } });

  const roundIds = new Map<string, string>();
  for (const r of plan.rounds) {
    const created = await tx.matchRound.create({
      data: { tournamentId, categoryId, number: r.number, name: r.name, isThirdPlace: r.isThirdPlace, status: r.number === 1 && !r.isThirdPlace ? "ACTIVE" : "PENDING" },
    });
    roundIds.set(`${r.number}:${r.isThirdPlace}`, created.id);
  }
  // Create from the final backwards so next-match ids exist.
  const ids = new Map<string, string>();
  const key = (r: number, p: number, third: boolean) => `${r}:${p}:${third}`;
  const third = plan.matches.find((m) => m.isThirdPlace);
  if (third) {
    const m = await tx.match.create({ data: { tournamentId, categoryId, roundId: roundIds.get(`${third.round}:true`)!, position: 0 } });
    ids.set(key(third.round, 0, true), m.id);
  }
  const ordered = plan.matches.filter((m) => !m.isThirdPlace).sort((a, b) => b.round - a.round || a.position - b.position);
  for (const m of ordered) {
    const created = await tx.match.create({
      data: {
        tournamentId,
        categoryId,
        roundId: roundIds.get(`${m.round}:false`)!,
        position: m.position,
        entryAId: m.entryAId,
        entryBId: m.entryBId,
        isBye: m.isBye,
        winnerId: m.winnerId,
        status: m.isBye ? "COMPLETED" : "SCHEDULED",
        completedAt: m.isBye ? new Date() : null,
        nextMatchId: m.nextRound ? ids.get(key(m.nextRound, m.nextPosition!, false)) : null,
        nextSlot: m.nextSlot,
        loserNextMatchId: m.loserNextSlot && third ? ids.get(key(third.round, 0, true)) : null,
        loserNextSlot: m.loserNextSlot,
      },
    });
    ids.set(key(m.round, m.position, false), created.id);
  }
}

export async function generateFixtures(actor: SessionUser, categoryId: string, opts: { mode: DrawMode; thirdPlace: boolean }) {
  const category = await db.tournamentCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new FixtureError("Category not found.");
  const entries = await confirmedEntries(categoryId);
  if (entries.length < 2) throw new FixtureError("At least 2 confirmed entries are needed to generate fixtures.");
  const pairs = firstRoundPairs(entries.map((e) => ({ id: e.id, seed: e.seed })), opts.mode);
  const plan = planBracket(pairs, { thirdPlace: opts.thirdPlace });

  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${categoryId}))`;
      await assertDrawEditable(tx, categoryId);
      await writeBracket(tx, category.tournamentId, categoryId, plan);
      await tx.tournamentCategory.update({ where: { id: categoryId }, data: { status: "DRAWN", thirdPlacePlayoff: opts.thirdPlace, championId: null } });
      await audit({ actorId: actor.id, action: "fixtures.generated", entityType: "TournamentCategory", entityId: categoryId, metadata: { mode: opts.mode, entries: entries.length, byes: plan.byes, thirdPlace: opts.thirdPlace } }, tx);
    },
    { timeout: 30_000 },
  );
  return { entries: entries.length, rounds: plan.totalRounds, byes: plan.byes };
}

/** Replace the first round with a manually arranged draw (only before any match has started). */
export async function saveManualDraw(actor: SessionUser, categoryId: string, pairs: [string | null, string | null][]) {
  const category = await db.tournamentCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new FixtureError("Category not found.");
  const entries = await confirmedEntries(categoryId);
  const valid = new Set(entries.map((e) => e.id));
  const used = pairs.flat().filter(Boolean) as string[];
  if (new Set(used).size !== used.length) throw new FixtureError("An entry appears more than once in the draw.");
  for (const id of used) if (!valid.has(id)) throw new FixtureError("The draw contains an entry that is not a confirmed registration in this category.");
  const missing = entries.filter((e) => !used.includes(e.id));
  if (missing.length) throw new FixtureError(`Every confirmed entry must be placed. Missing: ${missing.map((m) => entryName(m)).join(", ")}`);
  if (pairs.some(([a, b]) => !a && !b)) throw new FixtureError("A match cannot have two BYEs.");
  const plan = planBracket(pairs, { thirdPlace: category.thirdPlacePlayoff });
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${categoryId}))`;
      await assertDrawEditable(tx, categoryId);
      await writeBracket(tx, category.tournamentId, categoryId, plan);
      await tx.tournamentCategory.update({ where: { id: categoryId }, data: { status: "DRAWN", championId: null } });
      await audit({ actorId: actor.id, action: "fixtures.manual_draw", entityType: "TournamentCategory", entityId: categoryId, metadata: { pairs } }, tx);
    },
    { timeout: 30_000 },
  );
}

export async function resetFixtures(actor: SessionUser, categoryId: string) {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${categoryId}))`;
    await assertDrawEditable(tx, categoryId);
    await tx.match.deleteMany({ where: { categoryId } });
    await tx.matchRound.deleteMany({ where: { categoryId } });
    await tx.tournamentCategory.update({ where: { id: categoryId }, data: { status: "CLOSED", championId: null } });
    await audit({ actorId: actor.id, action: "fixtures.reset", entityType: "TournamentCategory", entityId: categoryId }, tx);
  });
}

export async function setSeeds(actor: SessionUser, categoryId: string, seeds: Record<string, number | null>) {
  const entries = await db.registration.findMany({ where: { categoryId, id: { in: Object.keys(seeds) } }, select: { id: true } });
  const values = Object.values(seeds).filter((v): v is number => v != null);
  if (new Set(values).size !== values.length) throw new FixtureError("Seed numbers must be unique.");
  if (values.some((v) => v < 1 || v > 64)) throw new FixtureError("Seeds must be between 1 and 64.");
  await db.$transaction(entries.map((e) => db.registration.update({ where: { id: e.id }, data: { seed: seeds[e.id] ?? null } })));
  await audit({ actorId: actor.id, action: "fixtures.seeds", entityType: "TournamentCategory", entityId: categoryId, metadata: seeds });
}

// ─────────────────────────────────────────────────────────────
// Match operations
// ─────────────────────────────────────────────────────────────

const matchInclude = {
  entryA: { include: entryInclude },
  entryB: { include: entryInclude },
  round: true,
  category: true,
  tournament: { include: { venue: true } },
} satisfies Prisma.MatchInclude;

function snapshot(m: { status: MatchStatus; court: string | null; scheduledAt: Date | null; winnerId: string | null; entryAId: string | null; entryBId: string | null; liveScore: string | null; notes: string | null }) {
  return { status: m.status, court: m.court, scheduledAt: m.scheduledAt?.toISOString() ?? null, winnerId: m.winnerId, entryAId: m.entryAId, entryBId: m.entryBId, liveScore: m.liveScore, notes: m.notes };
}

export async function updateMatchSchedule(actor: SessionUser, matchId: string, input: { court?: string | null; scheduledAt?: Date | null; notes?: string | null; notify?: boolean }) {
  const match = await db.match.findUnique({ where: { id: matchId }, include: matchInclude });
  if (!match) throw new FixtureError("Match not found.");
  if (match.status === "COMPLETED" || match.status === "CANCELLED") throw new FixtureError("Completed or cancelled matches can't be rescheduled.");
  if (match.isBye) throw new FixtureError("BYE matches don't need scheduling.");

  const timeChanged = input.scheduledAt !== undefined && (input.scheduledAt?.getTime() ?? null) !== (match.scheduledAt?.getTime() ?? null);
  const wasScheduled = Boolean(match.scheduledAt);
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.match.update({
      where: { id: matchId },
      data: {
        court: input.court !== undefined ? input.court || null : undefined,
        scheduledAt: input.scheduledAt !== undefined ? input.scheduledAt : undefined,
        notes: input.notes !== undefined ? input.notes || null : undefined,
        status: match.status === "SCHEDULED" && input.scheduledAt ? "UPCOMING" : match.status === "POSTPONED" && timeChanged && input.scheduledAt ? "UPCOMING" : undefined,
        version: { increment: 1 },
      },
    });
    await history(tx, matchId, wasScheduled && timeChanged ? "rescheduled" : "schedule_updated", actor.id, snapshot(match), snapshot(u));
    return u;
  });

  if ((input.notify ?? true) && timeChanged && updated.scheduledAt && match.entryA && match.entryB) {
    const rescheduled = wasScheduled;
    after(() => notifyMatchSchedule(matchId, rescheduled, updated.version));
  }
  return updated;
}

async function notifyMatchSchedule(matchId: string, rescheduled: boolean, version: number) {
  const m = await db.match.findUnique({ where: { id: matchId }, include: matchInclude });
  if (!m || !m.entryA || !m.entryB || !m.scheduledAt) return;
  for (const [self, opp] of [[m.entryA, m.entryB], [m.entryB, m.entryA]] as const) {
    for (const [to, name] of recipients(self)) {
      const tpl = T.matchScheduledTemplate(
        {
          participantName: name,
          tournamentName: m.tournament.name,
          categoryName: m.category.name,
          roundName: m.round.name,
          opponent: `${entryName(opp)}${opp.team ? ` (${entryPlayers(opp)})` : ""}`,
          when: formatDateTime(m.scheduledAt),
          court: m.court,
          venueName: m.tournament.venue?.name,
          mapsUrl: mapsLink(m.tournament.venue),
          matchesUrl: `${env.appUrl}/dashboard/matches`,
          bannerUrl: m.tournament.bannerUrl,
        },
        rescheduled,
      );
      await sendEmail({ dedupeKey: `match-${rescheduled ? "resched" : "sched"}:${m.id}:v${version}:${to}`, template: rescheduled ? "match_rescheduled" : "match_scheduled", to, ...tpl, tournamentId: m.tournamentId });
    }
  }
}

const ALLOWED_MANUAL: MatchStatus[] = ["SCHEDULED", "UPCOMING", "READY", "ONGOING", "POSTPONED", "CANCELLED"];

export async function setMatchStatus(actor: SessionUser, matchId: string, status: MatchStatus, liveScore?: string | null) {
  if (!ALLOWED_MANUAL.includes(status)) throw new FixtureError("Use “Record result” to complete a match.");
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) throw new FixtureError("Match not found.");
  if (match.status === "COMPLETED") throw new FixtureError("This match is completed. Use “Correct result” to change it.");
  if (match.isBye) throw new FixtureError("BYE matches can't be changed.");
  if ((status === "READY" || status === "ONGOING") && (!match.entryAId || !match.entryBId)) throw new FixtureError("Both players/teams must be known before the match can start.");
  await db.$transaction(async (tx) => {
    const res = await tx.match.updateMany({
      where: { id: matchId, version: match.version },
      data: {
        status,
        liveScore: liveScore !== undefined ? liveScore || null : undefined,
        startedAt: status === "ONGOING" && !match.startedAt ? new Date() : undefined,
        version: { increment: 1 },
      },
    });
    if (res.count === 0) throw new FixtureError("This match was updated by someone else. Refresh and try again.");
    await history(tx, matchId, `status:${status.toLowerCase()}`, actor.id, snapshot(match), { ...snapshot(match), status, liveScore: liveScore ?? match.liveScore });
  });
  const round = await db.match.findUnique({ where: { id: matchId }, select: { roundId: true, categoryId: true } });
  if (round && status === "ONGOING") {
    await db.matchRound.updateMany({ where: { id: round.roundId, status: "PENDING" }, data: { status: "ACTIVE" } });
    await db.tournamentCategory.updateMany({ where: { id: round.categoryId, status: "DRAWN" }, data: { status: "IN_PROGRESS" } });
  }
}

type ResultInput = { winnerId: string; score: string; durationMinutes?: number | null; remarks?: string | null };

async function placeInSlot(tx: Prisma.TransactionClient, targetId: string, slot: string, entryId: string | null) {
  await tx.match.update({ where: { id: targetId }, data: slot === "A" ? { entryAId: entryId, version: { increment: 1 } } : { entryBId: entryId, version: { increment: 1 } } });
}

async function refreshRoundAndCategory(tx: Prisma.TransactionClient, matchId: string) {
  const m = await tx.match.findUniqueOrThrow({ where: { id: matchId }, include: { round: true } });
  const open = await tx.match.count({ where: { roundId: m.roundId, status: { not: "COMPLETED" } } });
  await tx.matchRound.update({ where: { id: m.roundId }, data: { status: open === 0 ? "COMPLETED" : "ACTIVE" } });
  if (open === 0 && !m.round.isThirdPlace) {
    await tx.matchRound.updateMany({ where: { categoryId: m.categoryId, number: m.round.number + 1, isThirdPlace: false, status: "PENDING" }, data: { status: "ACTIVE" } });
    await tx.matchRound.updateMany({ where: { categoryId: m.categoryId, number: m.round.number + 1, isThirdPlace: true, status: "PENDING" }, data: { status: "ACTIVE" } });
  }
  // Category: completed when the final (and third-place match, if any) are completed.
  const remaining = await tx.match.count({ where: { categoryId: m.categoryId, status: { notIn: ["COMPLETED", "CANCELLED"] } } });
  const final = await tx.match.findFirst({ where: { categoryId: m.categoryId, nextMatchId: null, round: { isThirdPlace: false } }, orderBy: { round: { number: "desc" } } });
  if (remaining === 0 && final?.winnerId) {
    await tx.tournamentCategory.update({ where: { id: m.categoryId }, data: { status: "COMPLETED", championId: final.winnerId } });
  } else {
    await tx.tournamentCategory.update({ where: { id: m.categoryId }, data: { status: "IN_PROGRESS", championId: null } });
  }
  return { categoryCompleted: remaining === 0 && Boolean(final?.winnerId), categoryId: m.categoryId, tournamentId: m.tournamentId };
}

export async function recordResult(actor: SessionUser, matchId: string, input: ResultInput, expectedVersion?: number) {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) throw new FixtureError("Match not found.");
  if (match.status === "COMPLETED") throw new FixtureError("This match already has a result. Use “Correct result” to change it.");
  if (match.status === "CANCELLED") throw new FixtureError("This match is cancelled. Change its status before recording a result.");
  if (!match.entryAId || !match.entryBId) throw new FixtureError("Both players/teams must be known before recording a result.");
  if (input.winnerId !== match.entryAId && input.winnerId !== match.entryBId) throw new FixtureError("The winner must be one of the two entries in this match.");
  const loserId = input.winnerId === match.entryAId ? match.entryBId : match.entryAId;

  const outcome = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${match.categoryId}))`;
      const res = await tx.match.updateMany({
        where: { id: matchId, version: expectedVersion ?? match.version, status: { not: "COMPLETED" } },
        data: { status: "COMPLETED", winnerId: input.winnerId, completedAt: new Date(), startedAt: match.startedAt ?? new Date(), liveScore: input.score, version: { increment: 1 } },
      });
      if (res.count === 0) throw new FixtureError("This match was updated by someone else. Refresh and try again.");
      await tx.matchResult.create({
        data: { matchId, winnerId: input.winnerId, score: input.score, durationMinutes: input.durationMinutes ?? null, remarks: input.remarks ?? null, recordedById: actor.id },
      });
      if (match.nextMatchId && match.nextSlot) await placeInSlot(tx, match.nextMatchId, match.nextSlot, input.winnerId);
      if (match.loserNextMatchId && match.loserNextSlot) await placeInSlot(tx, match.loserNextMatchId, match.loserNextSlot, loserId);
      await history(tx, matchId, "result_recorded", actor.id, snapshot(match), { winnerId: input.winnerId, score: input.score, remarks: input.remarks ?? null });
      const state = await refreshRoundAndCategory(tx, matchId);
      await audit({ actorId: actor.id, action: "match.result", entityType: "Match", entityId: matchId, metadata: { winnerId: input.winnerId, score: input.score } }, tx);
      return state;
    },
    { timeout: 20_000 },
  );

  after(async () => {
    await notifyResult(matchId);
    if (outcome.categoryCompleted) await announceWinners(outcome.categoryId);
    await maybeCompleteTournament(outcome.tournamentId);
  });
  return outcome;
}

/**
 * Explicit administrative correction of a completed match. Only allowed while the downstream
 * match(es) the result feeds into have not started — otherwise the bracket would become inconsistent.
 */
export async function correctResult(actor: SessionUser, matchId: string, input: ResultInput & { reason: string }) {
  if (!input.reason || input.reason.trim().length < 5) throw new FixtureError("Please give a reason for the correction (min 5 characters).");
  const match = await db.match.findUnique({ where: { id: matchId }, include: { result: true } });
  if (!match) throw new FixtureError("Match not found.");
  if (match.status !== "COMPLETED" || match.isBye) throw new FixtureError("Only completed (non-BYE) matches can be corrected.");
  if (input.winnerId !== match.entryAId && input.winnerId !== match.entryBId) throw new FixtureError("The winner must be one of the two entries in this match.");
  const loserId = input.winnerId === match.entryAId ? match.entryBId : match.entryAId;
  const winnerChanged = input.winnerId !== match.winnerId;

  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${match.categoryId}))`;
    if (winnerChanged) {
      for (const downstreamId of [match.nextMatchId, match.loserNextMatchId].filter(Boolean) as string[]) {
        const d = await tx.match.findUniqueOrThrow({ where: { id: downstreamId } });
        if (d.status === "ONGOING" || d.status === "COMPLETED") {
          throw new FixtureError("The next-round match has already started or finished. Correct that match first (latest round backwards).");
        }
      }
      if (match.nextMatchId && match.nextSlot) await placeInSlot(tx, match.nextMatchId, match.nextSlot, input.winnerId);
      if (match.loserNextMatchId && match.loserNextSlot) await placeInSlot(tx, match.loserNextMatchId, match.loserNextSlot, loserId);
    }
    await tx.match.update({ where: { id: matchId }, data: { winnerId: input.winnerId, liveScore: input.score, version: { increment: 1 } } });
    await tx.matchResult.upsert({
      where: { matchId },
      create: { matchId, winnerId: input.winnerId, score: input.score, durationMinutes: input.durationMinutes ?? null, remarks: input.remarks ?? null, recordedById: actor.id },
      update: { winnerId: input.winnerId, score: input.score, durationMinutes: input.durationMinutes ?? null, remarks: input.remarks ?? null, recordedById: actor.id, recordedAt: new Date() },
    });
    await history(tx, matchId, "result_corrected", actor.id, { winnerId: match.winnerId, score: match.result?.score ?? null }, { winnerId: input.winnerId, score: input.score, reason: input.reason });
    await refreshRoundAndCategory(tx, matchId);
    await audit({ actorId: actor.id, action: "match.result_corrected", entityType: "Match", entityId: matchId, metadata: { from: match.winnerId, to: input.winnerId, reason: input.reason } }, tx);
  });
}

async function notifyResult(matchId: string) {
  const m = await db.match.findUnique({ where: { id: matchId }, include: { ...matchInclude, result: true } });
  if (!m || !m.entryA || !m.entryB || !m.result || m.isBye) return;
  const next = m.nextMatchId ? await db.match.findUnique({ where: { id: m.nextMatchId }, include: { round: true } }) : null;
  for (const [self, opp] of [[m.entryA, m.entryB], [m.entryB, m.entryA]] as const) {
    const won = m.winnerId === self.id;
    for (const [to, name] of recipients(self)) {
      const tpl = T.resultTemplate({
        participantName: name,
        tournamentName: m.tournament.name,
        categoryName: m.category.name,
        roundName: m.round.name,
        won,
        opponent: entryName(opp),
        score: m.result.score,
        nextRound: won ? next?.round.name ?? null : null,
        matchesUrl: `${env.appUrl}/dashboard/matches`,
      });
      await sendEmail({ dedupeKey: `result:${m.id}:${m.result.winnerId}:${to}`, template: "match_result", to, ...tpl, tournamentId: m.tournamentId });
    }
  }
}

export async function podium(categoryId: string) {
  const final = await db.match.findFirst({
    where: { categoryId, nextMatchId: null, round: { isThirdPlace: false } },
    orderBy: { round: { number: "desc" } },
    include: { entryA: { include: entryInclude }, entryB: { include: entryInclude } },
  });
  if (!final?.winnerId) return null;
  const champion = final.winnerId === final.entryAId ? final.entryA : final.entryB;
  const runnerUp = final.winnerId === final.entryAId ? final.entryB : final.entryA;
  const third = await db.match.findFirst({ where: { categoryId, round: { isThirdPlace: true }, status: "COMPLETED" }, include: { winner: { include: entryInclude } } });
  let thirdPlaces: EntryWithPeople[] = [];
  if (third?.winner) thirdPlaces = [third.winner];
  else {
    // No playoff: both losing semi-finalists share third place.
    const semis = await db.match.findMany({ where: { nextMatchId: final.id, status: "COMPLETED", isBye: false }, include: { entryA: { include: entryInclude }, entryB: { include: entryInclude } } });
    thirdPlaces = semis.map((s) => (s.winnerId === s.entryAId ? s.entryB : s.entryA)).filter(Boolean) as EntryWithPeople[];
  }
  return { champion: champion!, runnerUp, thirdPlaces };
}

async function announceWinners(categoryId: string) {
  const cat = await db.tournamentCategory.findUnique({ where: { id: categoryId }, include: { tournament: true } });
  const p = await podium(categoryId);
  if (!cat || !p) return;
  const entries = await db.registration.findMany({ where: { categoryId, status: "CONFIRMED" }, include: entryInclude });
  for (const e of entries) {
    for (const [to, name] of recipients(e)) {
      const tpl = T.winnerTemplate({
        recipientName: name,
        tournamentName: cat.tournament.name,
        categoryName: cat.name,
        champion: `${entryName(p.champion)}${p.champion.team ? ` (${entryPlayers(p.champion)})` : ""}`,
        runnerUp: p.runnerUp ? entryName(p.runnerUp) : null,
        third: p.thirdPlaces.map((x) => entryName(x)).join(" & ") || null,
        isChampion: e.id === p.champion.id,
        resultsUrl: `${env.appUrl}/tournaments/${cat.tournament.slug}#results`,
        bannerUrl: cat.tournament.bannerUrl,
      });
      await sendEmail({ dedupeKey: `winner:${categoryId}:${p.champion.id}:${to}`, template: "winner_announcement", to, ...tpl, tournamentId: cat.tournamentId });
    }
  }
}

async function maybeCompleteTournament(tournamentId: string) {
  const cats = await db.tournamentCategory.findMany({
    where: { tournamentId },
    select: { status: true, _count: { select: { matches: true, registrations: { where: { status: "CONFIRMED" } } } } },
  });
  // Every category that can be played (2+ confirmed entries) must be completed.
  const playable = cats.filter((c) => c._count.matches > 0 || c._count.registrations >= 2);
  if (playable.length && playable.every((c) => c.status === "COMPLETED")) {
    await db.tournament.updateMany({ where: { id: tournamentId, status: { in: ["PUBLISHED", "ONGOING"] } }, data: { status: "COMPLETED", resultsAnnouncedAt: new Date() } });
  }
}
