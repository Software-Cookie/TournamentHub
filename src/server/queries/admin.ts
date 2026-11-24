import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const PAIDISH = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "REFUND_PENDING"] as const;

/**
 * Dashboard figures from real records. `scope` limits everything to a set of tournaments
 * (an organiser's own); pass {} for the whole platform.
 */
export async function adminOverview(scope: Prisma.TournamentWhereInput = {}) {
  const now = new Date();
  const since = new Date(now.getTime() - 29 * 86400_000);
  since.setHours(0, 0, 0, 0);
  const inScope = { tournament: scope };

  const [tournamentsByStatus, regByStatus, players, teams, payAgg, payByStatus, refunds, matchByStatus, revenueByT, regsByCategory, recentRegs] = await Promise.all([
    db.tournament.groupBy({ by: ["status"], where: scope, _count: true }),
    db.registration.groupBy({ by: ["status"], where: inScope, _count: true }),
    db.participant.count({ where: { registration: { status: "CONFIRMED", ...inScope } } }),
    db.team.count({ where: { registration: { status: "CONFIRMED", ...inScope } } }),
    db.payment.aggregate({ where: { status: { in: [...PAIDISH] }, ...inScope }, _sum: { amount: true, fee: true, refundedAmount: true }, _count: true }),
    db.payment.groupBy({ by: ["status"], where: inScope, _count: true, _sum: { amount: true } }),
    db.refund.aggregate({ where: { status: { in: ["PROCESSED", "PENDING"] }, payment: inScope }, _sum: { amount: true }, _count: true }),
    db.match.groupBy({ by: ["status"], where: { isBye: false, ...inScope }, _count: true }),
    db.payment.groupBy({ by: ["tournamentId"], where: { status: { in: [...PAIDISH] }, ...inScope }, _sum: { amount: true, refundedAmount: true } }),
    db.registration.groupBy({ by: ["categoryId"], where: { status: "CONFIRMED", ...inScope }, _count: true }),
    db.registration.findMany({ where: { createdAt: { gte: since }, status: { notIn: ["EXPIRED"] }, ...inScope }, select: { createdAt: true, status: true } }),
  ]);

  const tCount = (s?: string) => tournamentsByStatus.filter((x) => !s || x.status === s).reduce((a, b) => a + b._count, 0);
  const rCount = (s: string) => regByStatus.find((x) => x.status === s)?._count ?? 0;
  const mCount = (s: string) => matchByStatus.find((x) => x.status === s)?._count ?? 0;

  const tNames = await db.tournament.findMany({ where: { id: { in: revenueByT.map((r) => r.tournamentId) } }, select: { id: true, name: true } });
  const nameOf = new Map(tNames.map((t) => [t.id, t.name]));
  const cats = await db.tournamentCategory.findMany({ where: { id: { in: regsByCategory.map((r) => r.categoryId) } }, select: { id: true, name: true } });
  const byCatName = new Map<string, number>();
  for (const r of regsByCategory) {
    const n = cats.find((c) => c.id === r.categoryId)?.name ?? "Other";
    byCatName.set(n, (byCatName.get(n) ?? 0) + r._count);
  }

  const days: { date: string; registrations: number; confirmed: number }[] = [];
  for (let i = 0; i < 30; i++) days.push({ date: new Date(since.getTime() + i * 86400_000).toISOString().slice(0, 10), registrations: 0, confirmed: 0 });
  for (const r of recentRegs) {
    const key = new Date(r.createdAt.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const d = days.find((x) => x.date === key);
    if (d) {
      d.registrations++;
      if (r.status === "CONFIRMED") d.confirmed++;
    }
  }

  const participation = await db.tournament.findMany({
    where: { ...scope, status: { in: ["PUBLISHED", "ONGOING", "COMPLETED"] } },
    orderBy: { startDate: "desc" },
    take: 8,
    select: { name: true, maxParticipants: true, _count: { select: { registrations: { where: { status: "CONFIRMED" } } } } },
  });

  const gross = payAgg._sum.amount ?? 0;
  const refunded = payAgg._sum.refundedAmount ?? 0;
  const fees = payAgg._sum.fee ?? 0;
  return {
    tournaments: { total: tCount(), active: tCount("PUBLISHED") + tCount("ONGOING"), completed: tCount("COMPLETED"), drafts: tCount("DRAFT") },
    registrations: { total: regByStatus.filter((r) => r.status !== "EXPIRED").reduce((a, b) => a + b._count, 0), confirmed: rCount("CONFIRMED"), pendingApproval: rCount("PENDING_APPROVAL") },
    players,
    teams,
    payments: {
      successful: payAgg._count,
      gross,
      refunded,
      fees,
      net: gross - refunded - fees,
      pending: payByStatus.filter((p) => p.status === "CREATED" || p.status === "PENDING").reduce((a, b) => a + b._count, 0),
      failed: payByStatus.find((p) => p.status === "FAILED")?._count ?? 0,
      refunds: refunds._count,
    },
    matches: { upcoming: mCount("SCHEDULED") + mCount("UPCOMING") + mCount("READY"), ongoing: mCount("ONGOING"), completed: mCount("COMPLETED") },
    charts: {
      revenueByTournament: revenueByT.map((r) => ({ name: nameOf.get(r.tournamentId) ?? "—", gross: (r._sum.amount ?? 0) / 100, net: ((r._sum.amount ?? 0) - (r._sum.refundedAmount ?? 0)) / 100 })).sort((a, b) => b.gross - a.gross).slice(0, 8),
      registrationsByCategory: [...byCatName.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      daily: days,
      paymentStatus: payByStatus.map((p) => ({ name: p.status, value: p._count })),
      participation: participation.map((p) => ({ name: p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name, confirmed: p._count.registrations, capacity: p.maxParticipants ?? 0 })).reverse(),
    },
  };
}

export async function tournamentFinance(scope: { tournamentId?: string; tournament?: Prisma.TournamentWhereInput } = {}) {
  const where: Prisma.PaymentWhereInput = { ...(scope.tournamentId ? { tournamentId: scope.tournamentId } : {}), ...(scope.tournament ? { tournament: scope.tournament } : {}) };
  const regWhere: Prisma.RegistrationWhereInput = { ...(scope.tournamentId ? { tournamentId: scope.tournamentId } : {}), ...(scope.tournament ? { tournament: scope.tournament } : {}) };
  const [byStatus, sums, regCount] = await Promise.all([
    db.payment.groupBy({ by: ["status"], where, _count: true, _sum: { amount: true } }),
    db.payment.aggregate({ where: { ...where, status: { in: [...PAIDISH] } }, _sum: { amount: true, fee: true, tax: true, refundedAmount: true }, _count: true }),
    db.registration.count({ where: { ...regWhere, status: { notIn: ["EXPIRED"] } } }),
  ]);
  const gross = sums._sum.amount ?? 0;
  const refunded = sums._sum.refundedAmount ?? 0;
  const fees = sums._sum.fee ?? 0;
  const count = (s: string[]) => byStatus.filter((b) => s.includes(b.status)).reduce((a, b) => a + b._count, 0);
  const amt = (s: string[]) => byStatus.filter((b) => s.includes(b.status)).reduce((a, b) => a + (b._sum.amount ?? 0), 0);
  return {
    registrations: regCount,
    successful: sums._count,
    gross,
    refunded,
    fees,
    tax: sums._sum.tax ?? 0,
    netAfterRefunds: gross - refunded,
    net: gross - refunded - fees,
    pending: { count: count(["CREATED", "PENDING"]), amount: amt(["CREATED", "PENDING"]) },
    failed: { count: count(["FAILED"]), amount: amt(["FAILED"]) },
  };
}

/** Per-organisation settlement: entry fees collected on their behalf vs payouts already made. */
export async function organisationBalances(organisationIds?: string[]) {
  const orgs = await db.organisation.findMany({
    where: organisationIds ? { id: { in: organisationIds } } : {},
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { tournaments: true, members: true } }, members: { where: { role: "OWNER" }, take: 1, include: { user: { select: { email: true, name: true } } } } },
  });
  const ids = orgs.map((o) => o.id);
  const [pay, payouts, listings] = await Promise.all([
    db.payment.groupBy({ by: ["tournamentId"], where: { status: { in: [...PAIDISH] }, tournament: { organisationId: { in: ids } } }, _sum: { amount: true, refundedAmount: true, fee: true } }),
    db.payout.groupBy({ by: ["organisationId"], where: { organisationId: { in: ids } }, _sum: { amount: true } }),
    db.listingFee.groupBy({ by: ["organisationId"], where: { organisationId: { in: ids }, status: "PAID" }, _sum: { amount: true }, _count: true }),
  ]);
  const tOrg = new Map((await db.tournament.findMany({ where: { id: { in: pay.map((p) => p.tournamentId) } }, select: { id: true, organisationId: true } })).map((t) => [t.id, t.organisationId]));
  const netBy = new Map<string, number>();
  for (const p of pay) {
    const org = tOrg.get(p.tournamentId);
    if (!org) continue;
    netBy.set(org, (netBy.get(org) ?? 0) + (p._sum.amount ?? 0) - (p._sum.refundedAmount ?? 0) - (p._sum.fee ?? 0));
  }
  return orgs.map((o) => {
    const collected = netBy.get(o.id) ?? 0;
    const paidOut = payouts.find((p) => p.organisationId === o.id)?._sum.amount ?? 0;
    const l = listings.find((x) => x.organisationId === o.id);
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      city: o.city,
      isActive: o.isActive,
      isPlatform: o.slug === "tournamenthub",
      owner: o.members[0]?.user ?? null,
      contactEmail: o.contactEmail,
      contactPhone: o.contactPhone,
      payoutUpi: o.payoutUpi,
      payoutAccount: o.payoutAccount,
      tournaments: o._count.tournaments,
      listingPaid: l?._sum.amount ?? 0,
      listingCount: l?._count ?? 0,
      collected,
      paidOut,
      balance: collected - paidOut,
    };
  });
}
