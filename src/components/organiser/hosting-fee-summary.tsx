import { GST_RATE, hostingFee, PLATFORM_CHARGE_RATE } from "@/lib/pricing";
import { cn, formatMoney } from "@/lib/utils";

/** Itemised hosting fee: listing fee + 2% platform charge + 18% GST. Server- and client-safe. */
export function HostingFeeSummary({ sportName, listingFee, className, tone = "light" }: { sportName: string; listingFee: number; className?: string; tone?: "light" | "plain" }) {
  const f = hostingFee(listingFee);
  const rows: [string, number][] = [
    [`${sportName} listing fee`, f.base],
    [`Platform charge (${PLATFORM_CHARGE_RATE * 100}%)`, f.platformFee],
    [`GST (${GST_RATE * 100}%)`, f.gst],
  ];
  return (
    <div className={cn("rounded-2xl border border-line", tone === "light" ? "bg-canvas" : "bg-white", className)} aria-live="polite">
      <dl className="divide-y divide-line text-sm">
        {rows.map(([label, v]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-muted">{label}</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(v)}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="font-extrabold">Total fee for hosting this event</dt>
          <dd className="display text-2xl text-navy tabular-nums">{f.total === 0 ? "Free" : formatMoney(f.total)}</dd>
        </div>
      </dl>
    </div>
  );
}
