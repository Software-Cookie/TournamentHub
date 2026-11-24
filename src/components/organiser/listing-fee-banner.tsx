"use client";

import { useRouter } from "next/navigation";
import { CreditCard, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { usePayment } from "@/components/payments/use-payment";
import { formatMoney } from "@/lib/utils";
import { hostingFee } from "@/lib/pricing";
import { HostingFeeSummary } from "@/components/organiser/hosting-fee-summary";

export function ListingFeeBanner({ tournamentId, sportName, amount }: { tournamentId: string; sportName: string; amount: number }) {
  const router = useRouter();
  const { pay, busy, overlay } = usePayment({
    onVerified: () => {
      toast.success("Hosting fee paid. You can publish your tournament now.");
      router.refresh();
    },
  });
  const total = hostingFee(amount).total;
  return (
    <div className="mb-5 rounded-2xl border border-accent/30 bg-accent-50 p-4">
      {overlay}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-navy">
          <Lock className="size-5" />
        </span>
        <div>
          <p className="font-extrabold">Pay the hosting fee to publish</p>
          <p className="text-sm text-muted">You can set everything up first. Players can register once the tournament is published.</p>
        </div>
      </div>
      <Button variant="accent" size="lg" loading={busy} onClick={() => pay({ listingTournamentId: tournamentId })} className="shrink-0">
        <CreditCard className="size-4" /> Pay {formatMoney(total)}
      </Button>
      </div>
      <HostingFeeSummary sportName={sportName} listingFee={amount} tone="plain" className="mt-4 sm:max-w-md" />
    </div>
  );
}
