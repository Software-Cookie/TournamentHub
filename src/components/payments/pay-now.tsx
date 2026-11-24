"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Timer } from "lucide-react";
import { Button } from "@/components/ui";
import { usePayment } from "@/components/payments/use-payment";
import { formatMoney } from "@/lib/utils";

export function PayNow({ registrationId, amount, expiresAt, retry }: { registrationId: string; amount: number; expiresAt: string | null; retry?: boolean }) {
  const router = useRouter();
  const { pay, busy, overlay } = usePayment({
    onVerified: (id) => router.replace(`/dashboard/registrations/${id}?paid=1`),
    onFailed: () => router.refresh(),
  });
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [expiresAt]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {overlay}
      <Button variant="accent" size="lg" loading={busy} onClick={() => pay(registrationId)}>
        <CreditCard className="size-4" /> {retry ? "Retry payment" : "Pay"} {formatMoney(amount)}
      </Button>
      {left != null && left > 0 && (
        <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
          <Timer className="size-4" /> Slot held for {Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}
