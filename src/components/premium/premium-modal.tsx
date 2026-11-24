"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { usePayment } from "@/components/payments/use-payment";
import { openAuthModal } from "@/components/auth/auth-modal";
import { PREMIUM_PLANS, YEARLY_DISCOUNT, type PremiumPlanId } from "@/lib/pricing";
import { cn, formatMoney } from "@/lib/utils";

const EVENT = "th:open-premium";

export function openPremiumModal() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Premium plan picker. Mounted once per layout; open it with openPremiumModal(). */
export function PremiumModal({ isAuthenticated, isPremium }: { isAuthenticated: boolean; isPremium: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<PremiumPlanId>("YEARLY");
  const dialogRef = useRef<HTMLDivElement>(null);
  const { pay, busy, overlay } = usePayment({
    onVerified: () => {
      setOpen(false);
      toast.success("Welcome to Premium. You can now register for premium events.");
      router.refresh();
    },
  });

  useEffect(() => {
    const onOpen = () => {
      if (!isAuthenticated) {
        openAuthModal("signup");
        toast.info("Create a free account first, then get Premium.");
        return;
      }
      setOpen(true);
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, busy]);

  const selected = PREMIUM_PLANS[plan];

  return (
    <>
      {overlay}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-navy/70 [animation:fade-in_.15s_ease-out]" onClick={() => !busy && setOpen(false)} aria-hidden />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="premium-title"
            className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-lift [animation:menu-in_.18s_ease-out] sm:max-w-[460px] sm:rounded-3xl"
          >
            <div className="bg-navy px-6 pb-6 pt-7 text-white">
              <div className="flex items-start gap-3 pr-10">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-premium text-navy">
                  <Crown className="size-5" />
                </span>
                <div>
                  <h2 id="premium-title" className="display text-2xl italic">
                    {isPremium ? "Extend Premium" : "Go Premium"}
                  </h2>
                  <p className="mt-0.5 text-sm text-white/75">Premium events have prize pools above ₹30,000 and are open to Premium members only.</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>

            <div className="p-6">
              <fieldset>
                <legend className="sr-only">Choose a plan</legend>
                <div className="grid gap-3">
                  {(Object.values(PREMIUM_PLANS) as (typeof PREMIUM_PLANS)[PremiumPlanId][]).map((p) => (
                    <label
                      key={p.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition-colors",
                        plan === p.id ? "border-brand bg-brand-50" : "border-line hover:border-brand/40",
                      )}
                    >
                      <input type="radio" name="premium-plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} className="size-4 accent-brand" data-autofocus={plan === p.id ? "" : undefined} />
                      <span className="flex-1">
                        <span className="flex items-center gap-2 font-extrabold">
                          {p.id === "MONTHLY" ? "Monthly" : "Yearly"}
                          {p.id === "YEARLY" && <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success">Save {Math.round(YEARLY_DISCOUNT * 100)}%</span>}
                        </span>
                        <span className="text-sm text-muted">{p.id === "MONTHLY" ? "Premium for 1 month" : `Premium for 12 months, ${formatMoney(Math.round(p.amount / 12))} a month`}</span>
                      </span>
                      <span className="text-right">
                        <span className="display block text-3xl text-navy">{formatMoney(p.amount)}</span>
                        {p.fullPrice > p.amount && <span className="text-xs text-subtle line-through">{formatMoney(p.fullPrice)}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <ul className="mt-5 space-y-2 text-sm">
                {["Register for every premium event", "Premium badge on your profile", "No auto-renewal: you choose when to extend"].map((b) => (
                  <li key={b} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" /> {b}
                  </li>
                ))}
              </ul>

              <Button variant="accent" size="lg" className="mt-6 w-full" loading={busy} onClick={() => pay({ membershipPlan: plan })}>
                Pay {formatMoney(selected.amount)}
              </Button>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="mt-3 w-full rounded-lg py-2 text-center text-sm font-medium text-subtle hover:text-ink">
                Not now
              </button>
              <p className="mt-2 text-center text-xs text-subtle">Secure payment by Razorpay. Prices include taxes.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** A button that opens the premium plan picker (usable from server components). */
export function PremiumButton({ children, className, variant = "accent", size = "lg" }: { children: React.ReactNode; className?: string; variant?: "accent" | "primary" | "secondary"; size?: "sm" | "md" | "lg" }) {
  return (
    <Button variant={variant} size={size} className={className} onClick={openPremiumModal}>
      {children}
    </Button>
  );
}
