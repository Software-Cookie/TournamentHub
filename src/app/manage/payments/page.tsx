import Link from "next/link";
import { getMemberOrgIds, isAdminRole, manageScope, requireManager } from "@/lib/authz";
import { db } from "@/lib/db";
import { organisationBalances, tournamentFinance } from "@/server/queries/admin";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { FinanceSummary, TransactionsTable } from "@/components/admin/finance";
import { formatDate, formatMoney } from "@/lib/utils";
import { CircleDollarSign, HandCoins, Wallet } from "lucide-react";

export const metadata = { title: "Revenue" };
export const dynamic = "force-dynamic";

export default async function ManagePaymentsPage() {
  const user = await requireManager("/manage/payments");
  const scope = await manageScope(user);
  const orgIds = await getMemberOrgIds(user.id);
  const [fin, tournaments, txs, balances, payouts, listings] = await Promise.all([
    tournamentFinance({ tournament: scope }),
    db.tournament.findMany({ where: { ...scope, payments: { some: {} } }, select: { id: true, name: true }, orderBy: { startDate: "desc" } }),
    db.payment.findMany({ where: { tournament: scope }, include: { tournament: { select: { name: true } }, registration: { select: { code: true } }, user: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    organisationBalances(isAdminRole(user.role) && !orgIds.length ? undefined : orgIds),
    db.payout.findMany({ where: { organisationId: { in: orgIds } }, orderBy: { paidAt: "desc" }, take: 20 }),
    db.listingFee.findMany({ where: { organisationId: { in: orgIds }, status: "PAID" }, include: { tournament: { select: { name: true } }, sport: { select: { name: true } } }, orderBy: { paidAt: "desc" }, take: 20 }),
  ]);
  const perT = await Promise.all(tournaments.map(async (t) => ({ t, f: await tournamentFinance({ tournamentId: t.id }) })));
  const mine = balances.filter((b) => orgIds.includes(b.id));
  const collected = mine.reduce((s, b) => s + b.collected, 0);
  const paidOut = mine.reduce((s, b) => s + b.paidOut, 0);

  return (
    <>
      <PageHeader title="Revenue" description="Entry fees are collected by TournamentHub on your behalf and settled to your UPI or bank account." />
      {mine.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Net entry fees collected" value={formatMoney(collected)} icon={<CircleDollarSign className="size-5" />} tone="blue" sub="after refunds & gateway charges" />
          <StatCard label="Settled to you" value={formatMoney(paidOut)} icon={<HandCoins className="size-5" />} tone="green" />
          <StatCard label="Due to you" value={formatMoney(Math.max(0, collected - paidOut))} icon={<Wallet className="size-5" />} tone="orange" sub={mine[0]?.payoutUpi ? `to ${mine[0].payoutUpi}` : "Add payout details in your profile"} />
        </div>
      )}
      <FinanceSummary f={fin} />

      <h2 className="mb-3 mt-8 text-lg font-extrabold">By tournament</h2>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-canvas text-left text-xs font-bold uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-4 py-3">Tournament</th>
                <th className="px-4 py-3 text-right">Paid entries</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">Refunded</th>
                <th className="px-4 py-3 text-right">Gateway fees</th>
                <th className="px-4 py-3 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {perT.map(({ t, f }) => (
                <tr key={t.id}>
                  <td className="px-4 py-3"><Link href={`/manage/tournaments/${t.id}/finance`} className="font-bold hover:text-brand">{t.name}</Link></td>
                  <td className="px-4 py-3 text-right tabular-nums">{f.successful}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(f.gross)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-violet-700">{formatMoney(f.refunded)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{formatMoney(f.fees)}</td>
                  <td className="px-4 py-3 text-right font-extrabold tabular-nums text-success">{formatMoney(f.net)}</td>
                </tr>
              ))}
              {perT.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No payments yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {(payouts.length > 0 || listings.length > 0) && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <h2 className="border-b border-line px-5 py-3 font-extrabold">Settlements received</h2>
            <ul className="divide-y divide-line text-sm">
              {payouts.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 px-5 py-3">
                  <span>{formatDate(p.paidAt)} <span className="font-mono text-xs text-subtle">{p.reference}</span></span>
                  <span className="font-bold tabular-nums">{formatMoney(p.amount)}</span>
                </li>
              ))}
              {payouts.length === 0 && <li className="px-5 py-4 text-subtle">No settlements yet.</li>}
            </ul>
          </Card>
          <Card className="overflow-hidden">
            <h2 className="border-b border-line px-5 py-3 font-extrabold">Listing fees paid</h2>
            <ul className="divide-y divide-line text-sm">
              {listings.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 px-5 py-3">
                  <span className="min-w-0 truncate">{l.tournament.name} <span className="text-xs text-subtle">({l.sport.name}, {formatDate(l.paidAt)})</span></span>
                  <span className="font-bold tabular-nums">{formatMoney(l.amount)}</span>
                </li>
              ))}
              {listings.length === 0 && <li className="px-5 py-4 text-subtle">None.</li>}
            </ul>
          </Card>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-extrabold">Recent transactions</h2>
      <TransactionsTable rows={txs.map((p) => ({ id: p.id, createdAt: p.createdAt, tournament: p.tournament.name, code: p.registration.code, account: p.user.email, orderId: p.providerOrderId, paymentId: p.providerPaymentId, method: p.method, status: p.status, amount: p.amount, fee: p.fee, refundedAmount: p.refundedAmount }))} />
    </>
  );
}
