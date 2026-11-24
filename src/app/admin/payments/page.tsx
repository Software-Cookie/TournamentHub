import { requireAdmin } from "@/lib/authz";
import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import type { PaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { tournamentFinance } from "@/server/queries/admin";
import { Card, PageHeader } from "@/components/ui";
import { FinanceSummary, TransactionsTable } from "@/components/admin/finance";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Revenue" };
export const dynamic = "force-dynamic";

const STATUSES: PaymentStatus[] = ["PAID", "CREATED", "PENDING", "FAILED", "REFUND_PENDING", "PARTIALLY_REFUNDED", "REFUNDED"];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status } = await searchParams;
  const [overall, tournaments, txs] = await Promise.all([
    tournamentFinance(),
    db.tournament.findMany({ where: { payments: { some: {} } }, select: { id: true, name: true }, orderBy: { startDate: "desc" } }),
    db.payment.findMany({
      where: status && STATUSES.includes(status as PaymentStatus) ? { status: status as PaymentStatus } : {},
      include: { tournament: { select: { name: true } }, registration: { select: { code: true } }, user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const perT = await Promise.all(tournaments.map(async (t) => ({ t, f: await tournamentFinance({ tournamentId: t.id }) })));

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Revenue & payments"
        description="Every figure is computed from verified payment records."
        actions={
          <>
            <a href="/api/manage/export?type=payments&format=csv" className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-canvas"><Download className="size-4" /> CSV</a>
            <a href="/api/manage/export?type=payments&format=xlsx" className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:bg-canvas"><FileSpreadsheet className="size-4" /> Excel</a>
          </>
        }
      />
      <FinanceSummary f={overall} />

      <h2 className="mb-3 mt-8 text-lg font-extrabold">By tournament</h2>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-canvas text-left text-xs font-bold uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-4 py-3">Tournament</th>
                <th className="px-4 py-3 text-right">Registrations</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">Pending</th>
                <th className="px-4 py-3 text-right">Failed</th>
                <th className="px-4 py-3 text-right">Refunded</th>
                <th className="px-4 py-3 text-right">Fees</th>
                <th className="px-4 py-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {perT.map(({ t, f }) => (
                <tr key={t.id} className="hover:bg-canvas/60">
                  <td className="px-4 py-3"><Link href={`/manage/tournaments/${t.id}/finance`} className="font-bold hover:text-brand">{t.name}</Link></td>
                  <td className="px-4 py-3 text-right tabular-nums">{f.registrations}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{f.successful}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(f.gross)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{f.pending.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{f.failed.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-violet-700">{formatMoney(f.refunded)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{formatMoney(f.fees)}</td>
                  <td className="px-4 py-3 text-right font-extrabold tabular-nums text-success">{formatMoney(f.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Transaction history</h2>
        <div className="flex flex-wrap gap-1.5">
          {[["", "All"], ...STATUSES.map((s) => [s, s.replace("_", " ").toLowerCase()])].map(([v, l]) => (
            <Link key={v} href={v ? `/admin/payments?status=${v}` : "/admin/payments"} className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${(status ?? "") === v ? "bg-navy text-white" : "bg-white text-muted ring-1 ring-line"}`}>{l}</Link>
          ))}
        </div>
      </div>
      <TransactionsTable rows={txs.map((p) => ({ id: p.id, createdAt: p.createdAt, tournament: p.tournament.name, code: p.registration.code, account: p.user.email, orderId: p.providerOrderId, paymentId: p.providerPaymentId, method: p.method, status: p.status, amount: p.amount, fee: p.fee, refundedAmount: p.refundedAmount }))} />
      <p className="mt-2 text-xs text-subtle">Showing the latest 100. Export for the complete history.</p>
    </>
  );
}
