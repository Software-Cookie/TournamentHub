import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { formatDate, formatMoney } from "@/lib/utils";
import { sendEmail } from "@/lib/email/send";
import { premiumReceiptTemplate } from "@/lib/email/templates";
import { createOrder, fetchAndCapturePayment, paymentMode, publicKeyId, verifyCheckoutSignature } from "@/lib/payments/razorpay";
import { extendPremium, isPremiumActive, PREMIUM_PLANS, type PremiumPlanId } from "@/lib/pricing";
import type { SessionUser } from "@/lib/authz";
import { RegistrationError } from "@/server/registrations";

/** Premium expiry for a user (request-cached). Always read from the database, never from the client. */
export const getPremiumUntil = cache(async (userId: string) => {
  const u = await db.user.findUnique({ where: { id: userId }, select: { premiumUntil: true } });
  return u?.premiumUntil ?? null;
});

export async function isPremiumUser(userId: string) {
  return isPremiumActive(await getPremiumUntil(userId));
}

/** Create (or resume) a Razorpay order for a premium plan. The price comes from the server only. */
export async function startMembershipPayment(user: SessionUser, planId: PremiumPlanId) {
  const plan = PREMIUM_PLANS[planId];
  const mode = paymentMode();
  if (mode === "unavailable") throw new RegistrationError("Online payments are not configured yet. Please contact support.");

  // Reuse a recent open order for the same plan and price instead of creating a new one per click.
  let m = await db.premiumMembership.findFirst({
    where: { userId: user.id, plan: plan.id, status: "CREATED", amount: plan.amount, createdAt: { gt: new Date(Date.now() - 6 * 3600_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (!m) {
    const order = await createOrder(plan.amount, "INR", `PREM-${user.id.slice(-10)}-${Date.now().toString(36)}`, { kind: "premium", userId: user.id, plan: plan.id });
    m = await db.premiumMembership.create({ data: { userId: user.id, plan: plan.id, amount: plan.amount, providerOrderId: order.id } });
  }
  return {
    mode,
    keyId: publicKeyId(),
    orderId: m.providerOrderId,
    amount: m.amount,
    currency: m.currency,
    registrationCode: `Premium · ${plan.label}`,
    tournamentName: "TournamentHub Premium",
    categoryName: `Premium ${plan.label}`,
    prefill: { name: user.name ?? "", email: user.email ?? "", contact: "" },
  };
}

/** Idempotently confirm a premium payment (checkout callback, webhook or reconciliation). */
export async function confirmMembershipPayment(input: { orderId: string; paymentId: string; via: "checkout" | "webhook" | "reconcile"; signature?: string }) {
  if (input.via === "checkout" && (!input.signature || !verifyCheckoutSignature(input.orderId, input.paymentId, input.signature))) {
    throw new RegistrationError("Payment signature verification failed.");
  }
  const m = await db.premiumMembership.findUnique({ where: { providerOrderId: input.orderId } });
  if (!m) throw new RegistrationError("Unknown order.");
  if (m.status === "PAID" || m.status === "REFUNDED") return { userId: m.userId, alreadyProcessed: true };

  const gw = await fetchAndCapturePayment(input.paymentId, m.amount, m.currency);
  if (gw.orderId && gw.orderId !== input.orderId) throw new RegistrationError("Payment does not belong to this order.");
  if (gw.status !== "captured") {
    if (gw.status === "failed") await markMembershipFailed(input.orderId, gw.errorDescription ?? "Payment failed");
    throw new RegistrationError(gw.status === "failed" ? "Payment failed." : "Payment is not yet captured. It will be confirmed automatically.");
  }
  if (gw.amount !== m.amount || gw.currency !== m.currency) {
    await audit({ action: "premium.amount_mismatch", entityType: "PremiumMembership", entityId: m.id, metadata: { expected: m.amount, got: gw.amount } });
    throw new RegistrationError("Payment amount mismatch. Our team has been notified.");
  }

  const plan = PREMIUM_PLANS[m.plan];
  const result = await db.$transaction(async (tx) => {
    // Serialise per user so two simultaneous purchases both extend the membership correctly.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`premium:${m.userId}`}))`;
    const u = await tx.user.findUniqueOrThrow({ where: { id: m.userId }, select: { premiumUntil: true } });
    const { start, end } = extendPremium(u.premiumUntil, plan.months);
    const res = await tx.premiumMembership.updateMany({
      where: { id: m.id, status: { in: ["CREATED", "FAILED"] } },
      data: { status: "PAID", providerPaymentId: gw.id, method: gw.method ?? null, fee: gw.fee ?? null, tax: gw.tax ?? null, paidAt: new Date(), startsAt: start, endsAt: end, verifiedVia: input.via, failureReason: null },
    });
    if (res.count === 0) return null;
    await tx.user.update({ where: { id: m.userId }, data: { premiumUntil: end } });
    await audit({ actorId: m.userId, action: "premium.paid", entityType: "User", entityId: m.userId, metadata: { plan: m.plan, amount: m.amount, until: end.toISOString(), via: input.via } }, tx);
    return end;
  });
  if (result) after(() => sendPremiumReceipt(m.id));
  return { userId: m.userId, alreadyProcessed: !result, premiumUntil: result };
}

export async function markMembershipFailed(orderId: string, reason: string) {
  await db.premiumMembership.updateMany({ where: { providerOrderId: orderId, status: "CREATED" }, data: { status: "FAILED", failureReason: reason.slice(0, 300) } });
}

async function sendPremiumReceipt(membershipId: string) {
  const m = await db.premiumMembership.findUnique({ where: { id: membershipId }, include: { user: { select: { email: true, name: true } } } });
  if (!m || !m.endsAt) return;
  const tpl = premiumReceiptTemplate({
    name: m.user.name,
    planLabel: `Premium, ${PREMIUM_PLANS[m.plan].label}`,
    amount: formatMoney(m.amount),
    validUntil: formatDate(m.endsAt),
    paymentId: m.providerPaymentId ?? "",
    url: `${env.appUrl}/tournaments?premium=1`,
  });
  await sendEmail({ dedupeKey: `premium-receipt:${m.id}`, template: "premium_receipt", to: m.user.email, ...tpl, userId: m.userId });
}
