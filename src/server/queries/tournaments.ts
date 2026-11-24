import "server-only";
import { PREMIUM_PRIZE_THRESHOLD } from "@/lib/pricing";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { activeEntryWhere, categoryFee, registrationWindow } from "@/server/registrations";

export const PUBLIC_STATUSES = ["PUBLISHED", "ONGOING", "COMPLETED"] as const;

const cardInclude = {
  sport: { select: { name: true, slug: true } },
  venue: { select: { name: true, city: true, state: true } },
  categories: { orderBy: { sortOrder: "asc" } },
  prizes: { orderBy: [{ position: "asc" }, { cashValue: "desc" }] },
} satisfies Prisma.TournamentInclude;

type CardRow = Prisma.TournamentGetPayload<{ include: typeof cardInclude }>;

export type TournamentCardData = ReturnType<typeof toCard>;

export function phaseOf(t: { status: string; startDate: Date; registrationOpensAt: Date; registrationClosesAt: Date }, now = new Date()) {
  if (t.status === "COMPLETED") return { key: "completed", label: "Completed", tone: "gray" } as const;
  if (t.status === "ONGOING" || (t.status === "PUBLISHED" && t.startDate <= now)) return { key: "ongoing", label: "Live now", tone: "red" } as const;
  const w = registrationWindow(t, now);
  if (w.open) {
    const hoursLeft = (t.registrationClosesAt.getTime() - now.getTime()) / 3600_000;
    return hoursLeft < 72 ? ({ key: "closing", label: "Closing soon", tone: "orange" } as const) : ({ key: "open", label: "Registration open", tone: "green" } as const);
  }
  if (now < t.registrationOpensAt) return { key: "soon", label: "Opening soon", tone: "blue" } as const;
  return { key: "closed", label: "Registration closed", tone: "gray" } as const;
}

function formats(t: CardRow) {
  const f = new Set<string>();
  for (const c of t.categories) {
    if (c.genderRule === "MIXED" && c.teamSize === 2) f.add("Mixed doubles");
    else if (c.teamSize === 1) f.add("Singles");
    else if (c.teamSize === 2) f.add("Doubles");
    else f.add("Team");
  }
  return [...f];
}

function toCard(t: CardRow, used: number) {
  const fees = t.categories.map((c) => categoryFee(t, c));
  const capacity = t.maxParticipants ?? (t.categories.every((c) => c.maxEntries != null) ? t.categories.reduce((s, c) => s + (c.maxEntries ?? 0), 0) : null);
  const topPrize = t.prizes.find((p) => p.position === 1) ?? t.prizes[0];
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    bannerUrl: t.bannerUrl,
    sport: t.sport.name,
    sportSlug: t.sport.slug,
    formats: formats(t),
    categories: t.categories.map((c) => c.name),
    city: t.venue?.city ?? null,
    venueName: t.venue?.name ?? null,
    startDate: t.startDate,
    registrationClosesAt: t.registrationClosesAt,
    minFee: fees.length ? Math.min(...fees) : t.entryFee,
    maxFee: fees.length ? Math.max(...fees) : t.entryFee,
    slotsLeft: capacity != null ? Math.max(0, capacity - used) : null,
    capacity,
    prizePool: t.prizePoolValue,
    topPrize: topPrize ? topPrize.title : null,
    phase: phaseOf(t),
    isDemo: t.isDemo,
  };
}

async function usedSlots(ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = await db.registration.groupBy({ by: ["tournamentId"], where: { tournamentId: { in: ids }, ...activeEntryWhere() }, _count: true });
  return new Map(rows.map((r) => [r.tournamentId, r._count]));
}

export type TournamentFilters = {
  q?: string;
  sport?: string;
  city?: string;
  from?: string;
  to?: string;
  maxFee?: number;
  premium?: boolean;
  format?: "singles" | "doubles" | "mixed" | "team";
  status?: "upcoming" | "ongoing" | "completed";
  sort?: "newest" | "upcoming" | "fee" | "prize";
};

export async function listPublicTournaments(f: TournamentFilters = {}) {
  const now = new Date();
  const where: Prisma.TournamentWhereInput = { status: { in: [...PUBLIC_STATUSES] } };
  const and: Prisma.TournamentWhereInput[] = [];
  if (f.q) and.push({ OR: [{ name: { contains: f.q, mode: "insensitive" } }, { tagline: { contains: f.q, mode: "insensitive" } }] });
  if (f.sport) and.push({ sport: { slug: f.sport } });
  if (f.city) and.push({ venue: { city: { contains: f.city, mode: "insensitive" } } });
  if (f.from) and.push({ startDate: { gte: new Date(`${f.from}T00:00:00+05:30`) } });
  if (f.to) and.push({ startDate: { lte: new Date(`${f.to}T23:59:59+05:30`) } });
  if (f.format === "singles") and.push({ categories: { some: { teamSize: 1 } } });
  if (f.format === "doubles") and.push({ categories: { some: { teamSize: 2, genderRule: { not: "MIXED" } } } });
  if (f.format === "mixed") and.push({ categories: { some: { genderRule: "MIXED", teamSize: 2 } } });
  if (f.format === "team") and.push({ categories: { some: { teamSize: { gt: 2 } } } });
  if (f.status === "upcoming") and.push({ status: "PUBLISHED", startDate: { gt: now } });
  if (f.status === "ongoing") and.push({ OR: [{ status: "ONGOING" }, { status: "PUBLISHED", startDate: { lte: now } }] });
  if (f.status === "completed") and.push({ status: "COMPLETED" });
  if (f.premium) and.push({ prizePoolValue: { gt: PREMIUM_PRIZE_THRESHOLD } });
  if (and.length) where.AND = and;

  const orderBy: Prisma.TournamentOrderByWithRelationInput[] =
    f.sort === "newest" ? [{ createdAt: "desc" }] : f.sort === "prize" ? [{ prizePoolValue: "desc" }, { startDate: "asc" }] : f.sort === "fee" ? [{ entryFee: "asc" }] : [{ startDate: "asc" }];

  const rows = await db.tournament.findMany({ where, include: cardInclude, orderBy, take: 60 });
  const used = await usedSlots(rows.map((r) => r.id));
  let cards = rows.map((r) => toCard(r, used.get(r.id) ?? 0));
  if (f.maxFee != null) cards = cards.filter((c) => c.minFee <= f.maxFee!);
  if (f.sort === "fee") cards.sort((a, b) => a.minFee - b.minFee);
  // Default "upcoming" ordering: open/upcoming first, then ongoing, then completed.
  if (!f.sort || f.sort === "upcoming") {
    const rank = { open: 0, closing: 0, soon: 1, closed: 2, ongoing: 3, completed: 4 } as const;
    cards.sort((a, b) => rank[a.phase.key] - rank[b.phase.key] || (a.phase.key === "completed" ? b.startDate.getTime() - a.startDate.getTime() : a.startDate.getTime() - b.startDate.getTime()));
  }
  return cards;
}

export async function featuredTournaments(limit = 6) {
  const rows = await db.tournament.findMany({
    where: { status: { in: ["PUBLISHED", "ONGOING"] } },
    include: cardInclude,
    orderBy: [{ isFeatured: "desc" }, { startDate: "asc" }],
    take: limit,
  });
  const used = await usedSlots(rows.map((r) => r.id));
  return rows.map((r) => toCard(r, used.get(r.id) ?? 0));
}

export async function completedHighlights(limit = 3) {
  const rows = await db.tournament.findMany({
    where: { status: "COMPLETED" },
    orderBy: { startDate: "desc" },
    take: limit,
    include: {
      venue: { select: { city: true } },
      images: { where: { kind: { in: ["GALLERY", "BANNER", "COURT"] } }, take: 4, orderBy: { sortOrder: "asc" } },
      categories: {
        where: { championId: { not: null } },
        orderBy: { sortOrder: "asc" },
        select: { name: true, championId: true },
      },
      _count: { select: { registrations: { where: { status: "CONFIRMED" } } } },
    },
  });
  const champIds = rows.flatMap((r) => r.categories.map((c) => c.championId!));
  const champs = await db.registration.findMany({ where: { id: { in: champIds } }, include: { team: true, participants: { select: { fullName: true } } } });
  const champName = new Map(champs.map((c) => [c.id, c.team?.name ?? c.participants.map((p) => p.fullName).join(" / ")]));
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    city: r.venue?.city,
    date: r.startDate,
    bannerUrl: r.bannerUrl ?? r.images[0]?.url ?? null,
    entries: r._count.registrations,
    winners: r.categories.map((c) => ({ category: c.name, winner: champName.get(c.championId!) ?? "—" })),
  }));
}

export async function getTournamentBySlug(slug: string) {
  const t = await db.tournament.findUnique({
    where: { slug },
    include: {
      sport: true,
      venue: true,
      organiser: true,
      categories: { orderBy: { sortOrder: "asc" } },
      prizes: { orderBy: [{ position: "asc" }], include: { category: { select: { name: true } } } },
      images: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
      sponsors: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!t) return null;
  const counts = await db.registration.groupBy({ by: ["categoryId"], where: { tournamentId: t.id, ...activeEntryWhere() }, _count: true });
  const used = new Map(counts.map((c) => [c.categoryId, c._count]));
  const totalUsed = counts.reduce((s, c) => s + c._count, 0);
  return {
    ...t,
    phase: phaseOf(t),
    window: registrationWindow(t),
    totalUsed,
    categoryStats: t.categories.map((c) => ({
      ...c,
      fee: categoryFee(t, c),
      used: used.get(c.id) ?? 0,
      left: c.maxEntries != null ? Math.max(0, c.maxEntries - (used.get(c.id) ?? 0)) : null,
    })),
  };
}

export async function platformStats() {
  const [tournaments, players, matches, cities] = await Promise.all([
    db.tournament.count({ where: { status: { in: [...PUBLIC_STATUSES] } } }),
    db.participant.count({ where: { registration: { status: "CONFIRMED" } } }),
    db.match.count({ where: { status: "COMPLETED", isBye: false } }),
    db.venue.findMany({ where: { tournaments: { some: { status: { in: [...PUBLIC_STATUSES] } } } }, distinct: ["city"], select: { city: true } }),
  ]);
  return { tournaments, players, matches, cities: cities.length };
}

/** Active sports with their live listing price and how many tournaments are open/upcoming. */
export async function sportsOverview() {
  const [sports, counts] = await Promise.all([
    db.sport.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true } }),
    db.tournament.groupBy({ by: ["sportId"], where: { status: { in: ["PUBLISHED", "ONGOING"] } }, _count: true }),
  ]);
  const by = new Map(counts.map((c) => [c.sportId, c._count]));
  return sports.map((s) => ({ ...s, live: by.get(s.id) ?? 0 }));
}
