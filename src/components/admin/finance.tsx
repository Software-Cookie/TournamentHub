import { Card, StatusBadge } from "@/components/ui";
import { formatDateTime, formatMoney } from "@/lib/utils";
import type { tournamentFinance } from "@/server/queries/admin";

type Fin = Awaited<ReturnType<typeof tournamentFinance>>;

export function FinanceSummary({ f }: { f: Fin }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card className="p-5">
        <h3 className="font-extrabold">Collections</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Registrations (excl. expired holds)" value={f.registrations.toString()} />
          <Row label="Successful payments" value={f.successful.toString()} />
          <Row label="Pending payments" value={`${f.pending.count} · ${formatMoney(f.pending.amount)}`} />
          <Row label="Failed payments" value={`${f.failed.count} · ${formatMoney(f.failed.amount)}`} />
        </dl>
      </Card>
      <Card className="p-5">
        <h3 className="font-extrabold">Gross → net</h3>
        <p className="text-xs text-subtle">Gross is what players paid. Net is what you actually keep.</p>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Gross collected" value={formatMoney(f.gross)} strong />
          <Row label="− Refunds" value={`− ${formatMoney(f.refunded)}`} tone="text-violet-700" />
          <Row label="= Net collected (after refunds)" value={formatMoney(f.netAfterRefunds)} />
          <Row label={`− Gateway fees (incl. ${formatMoney(f.tax)} GST)`} value={`− ${formatMoney(f.fees)}`} tone="text-danger" />
          <div className="border-t border-line pt-2">
            <Row label="Net revenue" value={formatMoney(f.net)} strong tone="text-success" />
          </div>
        </dl>
      </Card>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-lg font-extrabold" : "font-semibold"} ${tone ?? ""}`}>{value}</dd>
    </div>
  );
}

export type TxRow = { id: string; createdAt: Date; tournament: string; code: string; account: string; orderId: string; paymentId: string | null; method: string | null; status: string; amount: number; fee: number | null; refundedAmount: number };

export function TransactionsTable({ rows }: { rows: TxRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-canvas text-left text-xs font-bold uppercase tracking-wider text-subtle">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Tournament / entry</th>
              <th className="px-4 py-3">Gateway IDs</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Fee</th>
              <th className="px-4 py-3 text-right">Refunded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 text-xs text-muted">{formatDateTime(p.createdAt)}</td>
                <td className="px-4 py-2.5"><p className="font-semibold">{p.tournament}</p><p className="font-mono text-xs text-subtle">{p.code} · {p.account}</p></td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">{p.orderId}<br />{p.paymentId ?? "—"}{p.method ? ` · ${p.method}` : ""}</td>
                <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatMoney(p.amount)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted">{p.fee != null ? formatMoney(p.fee) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted">{p.refundedAmount ? formatMoney(p.refundedAmount) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No transactions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
