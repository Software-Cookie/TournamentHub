import { requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { organisationBalances } from "@/server/queries/admin";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui";
import { OrganiserRowActions } from "@/components/admin/organiser-actions";
import { formatDate, formatMoney } from "@/lib/utils";
import { HandCoins, Store, Wallet } from "lucide-react";

export const metadata = { title: "Organisers & payouts" };
export const dynamic = "force-dynamic";

export default async function OrganisersPage() {
  await requireAdmin();
  const [orgs, listings, payouts] = await Promise.all([
    organisationBalances(),
    db.listingFee.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { tournament: { select: { name: true } }, organisation: { select: { name: true } }, sport: { select: { name: true } } } }),
    db.payout.findMany({ orderBy: { paidAt: "desc" }, take: 25, include: { organisation: { select: { name: true } } } }),
  ]);
  const totalDue = orgs.filter((o) => !o.isPlatform).reduce((s, o) => s + Math.max(0, o.balance), 0);
  const listingRevenue = orgs.reduce((s, o) => s + o.listingPaid, 0);

  return (
    <>
      <PageHeader title="Organisers & payouts" description="Settle entry fees collected on each organiser's behalf, track listing-fee revenue, and suspend organisers if needed." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Organisers" value={orgs.filter((o) => !o.isPlatform).length} icon={<Store className="size-5" />} />
        <StatCard label="Listing fee revenue" value={formatMoney(listingRevenue)} icon={<Wallet className="size-5" />} tone="orange" />
        <StatCard label="Owed to organisers" value={formatMoney(totalDue)} icon={<HandCoins className="size-5" />} tone="green" sub="net entry fees not yet settled" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-canvas text-left text-xs font-bold uppercase tracking-wider text-subtle">
              <tr>
                <th className="px-4 py-3">Organiser</th>
                <th className="px-4 py-3">Payout details</th>
                <th className="px-4 py-3 text-right">Tournaments</th>
                <th className="px-4 py-3 text-right">Listing fees</th>
                <th className="px-4 py-3 text-right">Net collected</th>
                <th className="px-4 py-3 text-right">Settled</th>
                <th className="px-4 py-3 text-right">Due</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orgs.map((o) => (
                <tr key={o.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-bold">{o.name} {o.isPlatform && <Badge tone="dark" className="ml-1">Platform</Badge>} {!o.isActive && <Badge tone="red" className="ml-1">Suspended</Badge>}</p>
                    <p className="text-xs text-subtle">{o.owner?.email ?? o.contactEmail ?? "—"}{o.city ? `, ${o.city}` : ""}</p>
                    {o.contactPhone && <p className="text-xs text-subtle">{o.contactPhone}</p>}
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-muted">
                    {o.payoutUpi && <p className="font-mono">{o.payoutUpi}</p>}
                    {o.payoutAccount && <p className="break-words">{o.payoutAccount}</p>}
                    {!o.payoutUpi && !o.payoutAccount && <span className="text-subtle">Not provided</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{o.tournaments}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(o.listingPaid)} <span className="text-xs text-subtle">({o.listingCount})</span></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(o.collected)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(o.paidOut)}</td>
                  <td className={`px-4 py-3 text-right font-extrabold tabular-nums ${o.balance > 0 ? "text-success" : ""}`}>{formatMoney(o.balance)}</td>
                  <td className="px-4 py-3 text-right">{!o.isPlatform && <OrganiserRowActions organisationId={o.id} name={o.name} balance={o.balance} active={o.isActive} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-5 py-3 font-extrabold">Recent listing payments</h2>
          <ul className="divide-y divide-line text-sm">
            {listings.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{l.tournament.name}</span>
                  <span className="text-xs text-subtle">{l.organisation?.name ?? "—"}, {l.sport.name}, {formatDate(l.createdAt)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge tone={l.status === "PAID" ? "green" : l.status === "FAILED" ? "red" : "gray"}>{l.status.toLowerCase()}</Badge>
                  <span className="font-bold tabular-nums">{formatMoney(l.amount)}</span>
                </span>
              </li>
            ))}
            {listings.length === 0 && <li className="px-5 py-4 text-subtle">No listing payments yet.</li>}
          </ul>
        </Card>
        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-5 py-3 font-extrabold">Recent payouts</h2>
          <ul className="divide-y divide-line text-sm">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.organisation.name}</span>
                  <span className="text-xs text-subtle">{formatDate(p.paidAt)} · <span className="font-mono">{p.reference}</span></span>
                </span>
                <span className="font-bold tabular-nums">{formatMoney(p.amount)}</span>
              </li>
            ))}
            {payouts.length === 0 && <li className="px-5 py-4 text-subtle">No payouts recorded yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
