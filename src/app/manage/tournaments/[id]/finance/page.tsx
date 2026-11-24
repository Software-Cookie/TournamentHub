import { requireTournamentManager } from "@/lib/authz";
import { Download, FileSpreadsheet } from "lucide-react";
import { db } from "@/lib/db";
import { tournamentFinance } from "@/server/queries/admin";
import { FinanceSummary, TransactionsTable } from "@/components/admin/finance";

export const metadata = { title: "Finance" };
export const dynamic = "force-dynamic";

export default async function TournamentFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTournamentManager(id);
  const [f, txs] = await Promise.all([
    tournamentFinance({ tournamentId: id }),
    db.payment.findMany({ where: { tournamentId: id }, include: { tournament: { select: { name: true } }, registration: { select: { code: true } }, user: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <a href={`/api/manage/export?type=payments&tournamentId=${id}&format=csv`} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold hover:bg-canvas"><Download className="size-4" /> CSV</a>
        <a href={`/api/manage/export?type=payments&tournamentId=${id}&format=xlsx`} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold hover:bg-canvas"><FileSpreadsheet className="size-4" /> Excel</a>
      </div>
      <FinanceSummary f={f} />
      <TransactionsTable rows={txs.map((p) => ({ id: p.id, createdAt: p.createdAt, tournament: p.tournament.name, code: p.registration.code, account: p.user.email, orderId: p.providerOrderId, paymentId: p.providerPaymentId, method: p.method, status: p.status, amount: p.amount, fee: p.fee, refundedAmount: p.refundedAmount }))} />
    </div>
  );
}
