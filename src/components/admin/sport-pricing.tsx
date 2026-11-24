"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Card } from "@/components/ui";
import { SportIcon } from "@/components/sport-icon";
import { updateSportAction } from "@/server/actions/admin";
import { formatMoney } from "@/lib/utils";
import { hostingFee } from "@/lib/pricing";

type Sport = { id: string; slug: string; name: string; listingFee: number; isActive: boolean; paidCount: number; revenue: number };

export function SportPricing({ sports }: { sports: Sport[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-canvas text-left text-xs font-bold uppercase tracking-wider text-subtle">
            <tr>
              <th className="px-4 py-3">Sport</th>
              <th className="px-4 py-3">Listing fee (₹, before charges)</th>
              <th className="px-4 py-3">Organiser pays</th>
              <th className="px-4 py-3">Available to organisers</th>
              <th className="px-4 py-3 text-right">Paid listings</th>
              <th className="px-4 py-3 text-right">Revenue</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sports.map((s) => (
              <Row key={s.id} s={s} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Row({ s }: { s: Sport }) {
  const [fee, setFee] = useState(String(s.listingFee / 100));
  const [active, setActive] = useState(s.isActive);
  const [pending, start] = useTransition();
  const router = useRouter();
  const dirty = Number(fee) * 100 !== s.listingFee || active !== s.isActive;
  return (
    <tr>
      <td className="px-4 py-3">
        <span className="flex items-center gap-3 font-bold">
          <span className="grid size-9 place-items-center rounded-lg bg-navy text-white"><SportIcon sport={s.slug} className="size-[18px]" /></span>
          {s.name}
        </span>
      </td>
      <td className="px-4 py-3">
        <input type="number" min={0} step={1} value={fee} onChange={(e) => setFee(e.target.value)} className="input h-10 w-32" aria-label={`${s.name} listing fee`} />
      </td>
      <td className="px-4 py-3 tabular-nums text-muted" title="Listing fee + 2% platform charge + 18% GST">{Number.isFinite(Number(fee)) ? formatMoney(hostingFee(Math.round(Number(fee) * 100)).total) : "—"}</td>
      <td className="px-4 py-3">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="size-4 accent-brand" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {active ? "Enabled" : "Disabled"}
        </label>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{s.paidCount}</td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(s.revenue)}</td>
      <td className="px-4 py-3 text-right">
        <Button
          size="sm"
          disabled={!dirty || fee === "" || Number.isNaN(Number(fee))}
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await updateSportAction(s.id, { listingFeeRupees: Number(fee), isActive: active });
              if (r.ok) {
                toast.success(`${s.name}: ${Number(fee) === 0 ? "free listing" : formatMoney(Number(fee) * 100)}`);
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          Save
        </Button>
      </td>
    </tr>
  );
}
