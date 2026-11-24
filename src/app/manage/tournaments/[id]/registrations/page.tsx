import { requireTournamentManager } from "@/lib/authz";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { RegistrationsTable, type AdminRegRow } from "@/components/admin/registrations-table";

export const metadata = { title: "Registrations" };
export const dynamic = "force-dynamic";

const PAGE = 50;

export default async function AdminRegistrationsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireTournamentManager(id);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const where: Prisma.RegistrationWhereInput = { tournamentId: id };
  if (sp.category) where.categoryId = sp.category;
  if (sp.status && ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "REJECTED", "CANCELLED", "EXPIRED"].includes(sp.status)) where.status = sp.status as never;
  else where.status = { not: "EXPIRED" };
  if (sp.q) {
    const q = sp.q.trim().slice(0, 80);
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { team: { name: { contains: q, mode: "insensitive" } } },
      { participants: { some: { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } } },
    ];
  }
  const [total, regs, categories] = await Promise.all([
    db.registration.count({ where }),
    db.registration.findMany({
      where,
      include: {
        category: { select: { name: true } },
        team: true,
        participants: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "desc" }, include: { refunds: true } },
        ticket: true,
        user: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
    }),
    db.tournamentCategory.findMany({ where: { tournamentId: id }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const rows: AdminRegRow[] = regs.map((r) => ({
    id: r.id,
    code: r.code,
    category: r.category.name,
    status: r.status,
    amount: r.amount,
    createdAt: r.createdAt.toISOString(),
    teamName: r.team?.name ?? null,
    captain: r.team ? `${r.team.captainName} · ${r.team.captainPhone} · ${r.team.captainEmail}` : null,
    account: r.user.email,
    adminNote: r.adminNote,
    participants: r.participants.map((p) => ({ name: p.fullName, email: p.email, phone: p.phone, dob: p.dateOfBirth?.toISOString().slice(0, 10) ?? null, gender: p.gender, city: p.city, emergency: p.emergencyContactName ? `${p.emergencyContactName} (${p.emergencyContactPhone ?? "—"})` : null, skill: p.skillLevel })),
    answers: r.answers as Record<string, string | boolean>,
    ticket: r.ticket ? { number: r.ticket.number, checkedInAt: r.ticket.checkedInAt?.toISOString() ?? null, revoked: !!r.ticket.revokedAt } : null,
    payments: r.payments.map((p) => ({ id: p.id, status: p.status, amount: p.amount, refundedAmount: p.refundedAmount, orderId: p.providerOrderId, paymentId: p.providerPaymentId, method: p.method, paidAt: p.paidAt?.toISOString() ?? null, createdAt: p.createdAt.toISOString(), failureReason: p.failureReason, refunds: p.refunds.map((x) => ({ amount: x.amount, status: x.status, createdAt: x.createdAt.toISOString() })) })),
  }));
  return <RegistrationsTable tournamentId={id} rows={rows} total={total} page={page} pageSize={PAGE} categories={categories} />;
}
