import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { formatMoney } from "@/lib/utils";
import { sendEmail } from "@/lib/email/send";
import { listingReceiptTemplate } from "@/lib/email/templates";
import { createOrder, fetchAndCapturePayment, paymentMode, publicKeyId, verifyCheckoutSignature } from "@/lib/payments/razorpay";
import { canManageTournament, type SessionUser } from "@/lib/authz";
import { RegistrationError } from "@/server/registrations";
import { hostingFee } from "@/lib/pricing";

/**
 * Start (or resume) the listing-fee checkout for a tournament.
 * The amount always comes from the sport's live price in the database.
 */
export async function startListingPayment(user: SessionUser, tournamentId: string) {
  if (!(await canManageTournament(user, tournamentId))) throw new RegistrationError("Tournament not found.");
  const t = await db.tournament.findUnique({ where: { id: tournamentId }, include: { sport: true, listingFees: { where: { status: "CREATED" }, orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!t) throw new RegistrationError("Tournament not found.");
  if (t.listingStatus !== "UNPAID") throw new RegistrationError("The listing fee for this tournament is already settled.");

  const breakdown = hostingFee(t.sport.listingFee);
  const amount = breakdown.total;
  if (amount === 0) {
    await db.tournament.update({ where: { id: t.id }, data: { listingStatus: "WAIVED", listingPaidAt: new Date() } });
    return { free: true as const };
  }
  const mode = paymentMode();
  if (mode === "unavailable") throw new RegistrationError("Online payments are not configured yet. Please contact support.");

  let fee = t.listingFees[0];
  if (!fee || fee.amount !== amount) {
    const order = await createOrder(amount, "INR", `LIST-${t.id.slice(-12)}`, { kind: "listing", tournamentId: t.id });
    fee = await db.listingFee.create({ data: { tournamentId: t.id, organisationId: t.organisationId, sportId: t.sportId, userId: user.id, amount, baseAmount: breakdown.base, platformFee: breakdown.platformFee, gstAmount: breakdown.gst, providerOrderId: order.id } });
  }
  return {
    free: false as const,
    mode,
    keyId: publicKeyId(),
    orderId: fee.providerOrderId,
    amount: fee.amount,
    currency: fee.currency,
    registrationCode: `Listing · ${t.sport.name}`,
    tournamentName: t.name,
    categoryName: `${t.sport.name} hosting fee (incl. GST & platform charge)`,
    prefill: { name: user.name ?? "", email: user.email ?? "", contact: "" },
  };
}

/** Idempotently confirm a listing-fee payment (checkout callback, webhook or reconciliation). */
export async function confirmListingPayment(input: { orderId: string; paymentId: string; via: "checkout" | "webhook" | "reconcile"; signature?: string }) {
  if (input.via === "checkout" && (!input.signature || !verifyCheckoutSignature(input.orderId, input.paymentId, input.signature))) {
    throw new RegistrationError("Payment signature verification failed.");
  }
  const fee = await db.listingFee.findUnique({ where: { providerOrderId: input.orderId } });
  if (!fee) throw new RegistrationError("Unknown order.");
  if (fee.status === "PAID" || fee.status === "REFUNDED") return { tournamentId: fee.tournamentId, alreadyProcessed: true };

  const gw = await fetchAndCapturePayment(input.paymentId, fee.amount, fee.currency);
  if (gw.orderId && gw.orderId !== input.orderId) throw new RegistrationError("Payment does not belong to this order.");
  if (gw.status !== "captured") {
    if (gw.status === "failed") await markListingFailed(input.orderId, gw.errorDescription ?? "Payment failed");
    throw new RegistrationError(gw.status === "failed" ? "Payment failed." : "Payment is not yet captured. It will be confirmed automatically.");
  }
  if (gw.amount !== fee.amount || gw.currency !== fee.currency) {
    await audit({ action: "listing.amount_mismatch", entityType: "ListingFee", entityId: fee.id, metadata: { expected: fee.amount, got: gw.amount } });
    throw new RegistrationError("Payment amount mismatch. Our team has been notified.");
  }

  const flipped = await db.$transaction(async (tx) => {
    const res = await tx.listingFee.updateMany({
      where: { id: fee.id, status: { in: ["CREATED", "FAILED"] } },
      data: { status: "PAID", providerPaymentId: gw.id, method: gw.method ?? null, fee: gw.fee ?? null, tax: gw.tax ?? null, paidAt: new Date(), verifiedVia: input.via, failureReason: null },
    });
    if (res.count === 0) return false;
    await tx.tournament.update({ where: { id: fee.tournamentId }, data: { listingStatus: "PAID", listingPaidAt: new Date() } });
    await audit({ actorId: fee.userId, action: "listing.paid", entityType: "Tournament", entityId: fee.tournamentId, metadata: { amount: fee.amount, via: input.via } }, tx);
    return true;
  });
  if (flipped) after(() => sendListingReceipt(fee.id));
  return { tournamentId: fee.tournamentId, alreadyProcessed: !flipped };
}

export async function markListingFailed(orderId: string, reason: string) {
  await db.listingFee.updateMany({ where: { providerOrderId: orderId, status: "CREATED" }, data: { status: "FAILED", failureReason: reason.slice(0, 300) } });
}

async function sendListingReceipt(listingFeeId: string) {
  const fee = await db.listingFee.findUnique({ where: { id: listingFeeId }, include: { tournament: { select: { id: true, name: true } }, sport: { select: { name: true } } } });
  if (!fee) return;
  const user = await db.user.findUnique({ where: { id: fee.userId }, select: { email: true, name: true } });
  if (!user) return;
  const tpl = listingReceiptTemplate({
    name: user.name,
    tournamentName: fee.tournament.name,
    sportName: fee.sport.name,
    amount: formatMoney(fee.amount),
    base: formatMoney(fee.baseAmount || fee.amount),
    platformFee: formatMoney(fee.platformFee),
    gst: formatMoney(fee.gstAmount),
    paymentId: fee.providerPaymentId ?? "",
    manageUrl: `${env.appUrl}/manage/tournaments/${fee.tournament.id}`,
  });
  await sendEmail({ dedupeKey: `listing-receipt:${fee.id}`, template: "listing_receipt", to: user.email, ...tpl, userId: fee.userId, tournamentId: fee.tournamentId });
}
