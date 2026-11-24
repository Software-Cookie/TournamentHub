"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { FlaskConical, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

type OrderResponse = {
  mode: "razorpay" | "simulator";
  keyId: string | null;
  orderId: string;
  amount: number;
  currency: string;
  registrationCode: string;
  tournamentName: string;
  categoryName: string;
  prefill: { name: string; email: string; contact: string };
};

type RazorpayHandlerResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (ev: string, cb: (r: { error: { description?: string; metadata?: { order_id?: string; payment_id?: string } } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadCheckout() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export type PaymentPhase = "idle" | "creating" | "checkout" | "verifying" | "done";

/**
 * Drives the full checkout: create order (server) → Razorpay Checkout → server-side verification.
 * Success is only reported after the backend has verified the signature and the gateway state.
 */
export type PayTarget = string | { listingTournamentId: string } | { membershipPlan: "MONTHLY" | "YEARLY" };
export type PaymentKind = "registration" | "listing" | "premium";

const targetId = (t: PayTarget) => (typeof t === "string" ? t : "listingTournamentId" in t ? t.listingTournamentId : t.membershipPlan);

export function usePayment({ onVerified, onFailed }: { onVerified: (id: string, status: string, kind: PaymentKind) => void; onFailed?: (msg: string) => void }) {
  const [phase, setPhase] = useState<PaymentPhase>("idle");
  const [sim, setSim] = useState<{ order: OrderResponse; resolve: (ok: boolean) => void } | null>(null);

  const verify = useCallback(
    async (fallbackId: string, r: RazorpayHandlerResponse) => {
      setPhase("verifying");
      try {
        const v = await post<{ kind: PaymentKind; registrationId?: string; tournamentId?: string; status: string; refunded?: boolean }>("/api/payments/verify", r);
        if (v.refunded) {
          toast.warning("Your payment was received, but this slot is no longer available. A full refund has been initiated.");
          setPhase("idle");
          onFailed?.("refunded");
          return;
        }
        setPhase("done");
        onVerified((v.kind === "listing" ? v.tournamentId : v.registrationId) ?? fallbackId, v.status, v.kind);
      } catch (e) {
        setPhase("idle");
        const msg = e instanceof Error ? e.message : "Verification failed";
        toast.error(`${msg} If money was debited, it will be confirmed automatically or refunded.`);
        onFailed?.(msg);
      } finally {
        sessionStorage.removeItem("th:checkout-active");
      }
    },
    [onVerified, onFailed],
  );

  const pay = useCallback(
    async (target: PayTarget) => {
      const fallbackId = targetId(target);
      setPhase("creating");
      sessionStorage.setItem("th:checkout-active", "1");
      let order: OrderResponse;
      try {
        order = await post<OrderResponse>("/api/payments/order", typeof target === "string" ? { registrationId: target } : target);
      } catch (e) {
        setPhase("idle");
        sessionStorage.removeItem("th:checkout-active");
        toast.error(e instanceof Error ? e.message : "Could not start payment");
        onFailed?.("order");
        return;
      }

      if ((order as { free?: boolean }).free) {
        sessionStorage.removeItem("th:checkout-active");
        setPhase("done");
        onVerified(fallbackId, "PAID", "listing");
        return;
      }
      if (order.mode === "simulator") {
        setPhase("checkout");
        const ok = await new Promise<boolean>((resolve) => setSim({ order, resolve }));
        setSim(null);
        if (ok) await verify(fallbackId, { razorpay_order_id: order.orderId, razorpay_payment_id: `sim_pay_${Date.now().toString(36)}`, razorpay_signature: "simulated" });
        else {
          await post("/api/payments/failed", { orderId: order.orderId, reason: "Simulated failure" }).catch(() => {});
          setPhase("idle");
          sessionStorage.removeItem("th:checkout-active");
          toast.error("Payment failed. You can retry from your dashboard.");
          onFailed?.("failed");
        }
        return;
      }

      const loaded = await loadCheckout();
      if (!loaded || !window.Razorpay) {
        setPhase("idle");
        sessionStorage.removeItem("th:checkout-active");
        toast.error("Couldn't load the payment window. Check your connection and try again.");
        return;
      }
      setPhase("checkout");
      const rz = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "TournamentHub",
        description: `${order.categoryName} · ${order.tournamentName}`,
        image: `${window.location.origin}/brand/logo-icon.png`,
        prefill: order.prefill,
        notes: { registration: order.registrationCode },
        theme: { color: "#2D5AB8" },
        handler: (r: RazorpayHandlerResponse) => verify(fallbackId, r),
        modal: {
          confirm_close: true,
          ondismiss: () => {
            setPhase((p) => (p === "checkout" ? "idle" : p));
            sessionStorage.removeItem("th:checkout-active");
          },
        },
      });
      rz.on("payment.failed", (resp) => {
        post("/api/payments/failed", { orderId: order.orderId, paymentId: resp.error.metadata?.payment_id, reason: resp.error.description }).catch(() => {});
        toast.error(resp.error.description || "Payment failed. Please try again.");
      });
      rz.open();
    },
    [verify, onFailed, onVerified],
  );

  const overlay =
    typeof document !== "undefined"
      ? createPortal(
          <AnimatePresence>
            {(phase === "creating" || phase === "verifying") && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[95] grid place-items-center bg-navy/70 backdrop-blur-sm" role="dialog" data-busy aria-live="assertive">
                <div className="mx-4 w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
                  <div className="relative mx-auto size-16">
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-brand-100 border-t-brand" />
                    <ShieldCheck className="absolute inset-0 m-auto size-7 text-brand" />
                  </div>
                  <p className="mt-5 text-lg font-extrabold">{phase === "creating" ? "Preparing secure checkout…" : "Verifying your payment…"}</p>
                  <p className="mt-1 text-sm text-muted">{phase === "verifying" ? "Confirming with the bank. Please don't close or refresh this page." : "Hold tight, this takes a second."}</p>
                </div>
              </motion.div>
            )}
            {sim && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[96] grid place-items-center bg-navy/70 backdrop-blur-sm" role="dialog" data-busy>
                <div className="mx-4 w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
                  <div className="flex items-center gap-2 bg-premium px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-navy">
                    <FlaskConical className="size-4" /> Development payment simulator
                  </div>
                  <div className="p-6">
                    <p className="text-sm text-muted">Razorpay keys are not configured, so this local build simulates the gateway. This is disabled in production.</p>
                    <p className="mt-4 text-sm text-subtle">{sim.order.categoryName} · {sim.order.tournamentName}</p>
                    <p className="display mt-1 text-4xl">{formatMoney(sim.order.amount)}</p>
                    <div className="mt-6 grid grid-cols-2 gap-2">
                      <Button variant="secondary" onClick={() => sim.resolve(false)}>Simulate failure</Button>
                      <Button variant="success" onClick={() => sim.resolve(true)}>Simulate success</Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )
      : null;

  return { pay, phase, busy: phase !== "idle" && phase !== "done", overlay };
}

export function PayingSpinner() {
  return <Loader2 className="size-4 animate-spin" />;
}
