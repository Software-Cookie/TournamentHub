import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import type { TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { isAdminRole, manageScope, requireManager } from "@/lib/authz";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { SportIcon } from "@/components/sport-icon";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Tournaments" };
export const dynamic = "force-dynamic";

const STATUSES: TournamentStatus[] = ["DRAFT", "PUBLISHED", "ONGOING", "COMPLETED", "CANCELLED", "ARCHIVED"];

export default async function ManageTournamentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireManager("/manage/tournaments");
  const scope = await manageScope(user);
  const { status } = await searchParams;
  const list = await db.tournament.findMany({
    where: { ...scope, ...(status && STATUSES.includes(status as TournamentStatus) ? { status: status as TournamentStatus } : { status: { not: "ARCHIVED" } }) },
    orderBy: [{ startDate: "desc" }],
    include: { sport: { select: { slug: true, name: true } }, organisation: { select: { name: true } }, venue: { select: { city: true } }, _count: { select: { registrations: { where: { status: "CONFIRMED" } }, categories: true } } },
  });
  const ids = list.map((t) => t.id);
  const [pendingApproval, revenue] = await Promise.all([
    db.registration.groupBy({ by: ["tournamentId"], where: { tournamentId: { in: ids }, status: "PENDING_APPROVAL" }, _count: true }),
    db.payment.groupBy({ by: ["tournamentId"], where: { tournamentId: { in: ids }, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "REFUND_PENDING"] } }, _sum: { amount: true, refundedAmount: true } }),
  ]);
  const pa = new Map(pendingApproval.map((p) => [p.tournamentId, p._count]));
  const rev = new Map(revenue.map((r) => [r.tournamentId, (r._sum.amount ?? 0) - (r._sum.refundedAmount ?? 0)]));
  const admin = isAdminRole(user.role);

  return (
    <>
      <PageHeader title="Tournaments" description={admin ? "Every tournament on the platform." : "Your tournaments. Each one runs independently."} actions={<ButtonLink href="/manage/tournaments/new" variant="accent"><Plus className="size-4" /> New tournament</ButtonLink>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {[["", "All active"], ...STATUSES.map((v) => [v, v[0] + v.slice(1).toLowerCase()])].map(([v, l]) => (
          <Link key={v} href={v ? `/manage/tournaments?status=${v}` : "/manage/tournaments"} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${(status ?? "") === v ? "bg-navy text-white" : "bg-white text-muted ring-1 ring-line hover:text-ink"}`}>
            {l}
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<Trophy className="size-6" />} title="No tournaments here" action={<ButtonLink href="/manage/tournaments/new" variant="accent">Create a tournament</ButtonLink>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-canvas text-left text-xs font-bold uppercase tracking-wider text-subtle">
                <tr>
                  <th className="px-4 py-3">Tournament</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3 text-right">Confirmed</th>
                  <th className="px-4 py-3 text-right">Net collected</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((t) => (
                  <tr key={t.id} className="hover:bg-canvas/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy text-white"><SportIcon sport={t.sport.slug} className="size-[18px]" /></span>
                        <div className="min-w-0">
                          <Link href={`/manage/tournaments/${t.id}`} className="font-bold hover:text-brand">{t.name}</Link>
                          <p className="text-xs text-subtle">
                            {t.sport.name}, {t.venue?.city ?? "venue TBA"}
                            {admin && t.organisation ? ` — ${t.organisation.name}` : ""}
                            {t.isDemo && <Badge className="ml-1">Sample</Badge>}
                            {pa.get(t.id) ? <Badge tone="purple" className="ml-1">{pa.get(t.id)} to approve</Badge> : null}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(t.startDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3">{t.listingStatus === "UNPAID" ? <Badge tone="orange">Fee due</Badge> : t.listingStatus === "PAID" ? <Badge tone="green">Paid</Badge> : <Badge tone="gray">Waived</Badge>}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{t._count.registrations}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(rev.get(t.id) ?? 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1 text-xs font-semibold">
                        <Link href={`/manage/tournaments/${t.id}/registrations`} className="rounded-lg px-2 py-1 text-brand hover:bg-brand-50">Entries</Link>
                        <Link href={`/manage/tournaments/${t.id}/fixtures`} className="rounded-lg px-2 py-1 text-brand hover:bg-brand-50">Fixtures</Link>
                        <Link href={`/manage/tournaments/${t.id}`} className="rounded-lg px-2 py-1 text-brand hover:bg-brand-50">Edit</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
